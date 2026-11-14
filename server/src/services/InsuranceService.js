/**
 * InsuranceService — credit life cover on a loan.
 *
 * A policy is issued automatically when an insured loan is disbursed, inside the
 * same transaction, so a loan can never go live with the premium deducted but no
 * policy on file.
 *
 * A claim runs: lodged -> assessing -> approved | rejected -> settled. Settling
 * clears whatever the loan still owes and splits any surplus across the client's
 * nominated beneficiaries.
 */
const db = require('../config/db');
const { policyRepository, claimRepository } = require('../repositories/InsuranceRepository');
const loanRepository = require('../repositories/LoanRepository');
const { getPremiumStrategy } = require('./insurance/PremiumStrategy');
const BeneficiaryService = require('./BeneficiaryService');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');

class InsuranceService {
  /** Price cover without saving anything — used by the loan quote. */
  static quote({ principal, termMonths, product, totalPayable }) {
    const strategy = getPremiumStrategy(product.insurance_method);
    const priced = strategy.price({
      principal: Number(principal),
      termMonths: Number(termMonths),
      ratePct: Number(product.insurance_rate_pct),
      totalPayable: totalPayable === undefined ? undefined : Number(totalPayable),
    });
    return { ...priced, insured: strategy.name !== 'none', method: strategy.name };
  }

  /**
   * Issue the policy for a loan being disbursed. Called by LoanService inside
   * its transaction, so it takes the open connection.
   */
  static async issueForLoan(loan, product, startDate, totalPayable, tx) {
    const quote = InsuranceService.quote({
      principal: loan.principal, termMonths: loan.term_months, product, totalPayable,
    });
    if (!quote.insured || quote.premium <= 0) return null;

    const policyNo = await policyRepository.nextPolicyNo(tx);
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + Number(loan.term_months));

    const id = await policyRepository.create({
      policy_no: policyNo,
      loan_id: loan.id,
      client_id: loan.client_id,
      cover_method: quote.coverMethod,
      cover_amount: quote.coverAmount,
      premium: quote.premium,
      premium_rate_pct: product.insurance_rate_pct,
      start_date: startDate,
      end_date: end.toISOString().slice(0, 10),
      status: 'active',
    }, tx);

    return { id, policy_no: policyNo, ...quote };
  }

  static async detail(policyId) {
    const policy = (await policyRepository.search({ limit: 500 })).find((p) => p.id === Number(policyId));
    if (!policy) throw ApiError.notFound('Policy not found');
    const claims = await claimRepository.search({ limit: 50 });
    return { ...policy, claims: claims.filter((c) => c.policy_id === Number(policyId)) };
  }

  /* ---------------- claims ---------------- */

  static async lodgeClaim({ policy_id, claim_type, incident_date, notes }, actor) {
    const policy = await policyRepository.findById(policy_id);
    if (!policy) throw ApiError.notFound('Policy not found');
    if (policy.status !== 'active') {
      throw ApiError.conflict(`Cover on this policy is ${policy.status}, so a claim cannot be lodged against it`);
    }

    const incident = new Date(incident_date);
    if (incident < new Date(policy.start_date)) {
      throw ApiError.badRequest('The incident predates the start of cover', {
        incident_date: `Cover began on ${policy.start_date}`,
      });
    }
    if (incident > new Date()) {
      throw ApiError.badRequest('The incident date is in the future', { incident_date: 'Enter a date on or before today' });
    }

    const open = await claimRepository.findWhere(
      "policy_id = ? AND status IN ('lodged','assessing','approved')", [policy_id]
    );
    if (open.length) throw ApiError.conflict('A claim is already open against this policy');

    const loan = await loanRepository.findById(policy.loan_id);
    const cover = policy.cover_method === 'declining'
      ? Number(loan.outstanding_balance)
      : Number(policy.cover_amount);

    return db.transaction(async (tx) => {
      const claimNo = await claimRepository.nextClaimNo(tx);
      const id = await claimRepository.create({
        claim_no: claimNo,
        policy_id,
        claim_type,
        incident_date: String(incident_date).slice(0, 10),
        lodged_at: new Date().toISOString().slice(0, 10),
        lodged_by: actor.id,
        claimed_amount: round2(cover),
        decision_notes: notes || null,
        status: 'lodged',
      }, tx);

      const claim = await claimRepository.findDetailed(id, tx);
      publish('insurance.claim_lodged', {
        loan, actorId: actor.id, entityId: id,
        details: { claim_no: claimNo, claim_type, cover },
      });
      return claim;
    });
  }

  static async assessClaim(claimId, { decision, approved_amount, notes }, actor) {
    const claim = await claimRepository.findDetailed(claimId);
    if (!claim) throw ApiError.notFound('Claim not found');
    if (!['lodged', 'assessing'].includes(claim.status)) {
      throw ApiError.conflict(`This claim is already ${claim.status}`);
    }

    if (decision === 'reject') {
      if (!notes) throw ApiError.badRequest('Give a reason', { notes: 'A rejected claim must carry a reason' });
      await claimRepository.update(claimId, {
        status: 'rejected', assessed_by: actor.id, assessed_at: new Date(), decision_notes: notes,
      });
      const updated = await claimRepository.findDetailed(claimId);
      publish('insurance.claim_rejected', { actorId: actor.id, entityId: claimId, details: { notes } });
      return updated;
    }

    const approved = round2(approved_amount === undefined ? claim.claimed_amount : approved_amount);
    if (approved <= 0) throw ApiError.badRequest('Approve an amount above zero', { approved_amount: 'Must be more than zero' });
    if (approved > Number(claim.claimed_amount) + 0.005) {
      throw ApiError.badRequest('The approved amount exceeds the cover', {
        approved_amount: `Cover on this policy is ${claim.claimed_amount}`,
      });
    }

    await claimRepository.update(claimId, {
      status: 'approved', approved_amount: approved, assessed_by: actor.id,
      assessed_at: new Date(), decision_notes: notes || null,
    });
    const updated = await claimRepository.findDetailed(claimId);
    publish('insurance.claim_approved', { actorId: actor.id, entityId: claimId, details: { approved } });
    return updated;
  }

  /**
   * Settle an approved claim: clear what the loan still owes, then split any
   * surplus across the nominated beneficiaries. Both the loan write-down and
   * the claim record move together or not at all.
   */
  static async settleClaim(claimId, actor) {
    const claim = await claimRepository.findDetailed(claimId);
    if (!claim) throw ApiError.notFound('Claim not found');
    if (claim.status !== 'approved') throw ApiError.conflict('Only an approved claim can be settled');

    const loan = await loanRepository.findById(claim.loan_id);
    const owing = round2(Number(loan.outstanding_balance));
    const approved = round2(Number(claim.approved_amount));
    const toLoan = Math.min(approved, owing);
    const surplus = round2(approved - toLoan);

    // Fails loudly if the nominations do not total 100%, before anything is written.
    const split = surplus > 0 ? await BeneficiaryService.splitPayout(claim.client_id, surplus) : [];

    return db.transaction(async (tx) => {
      if (toLoan > 0) {
        // Apply the settlement to the schedule the same way a counter payment
        // would — oldest instalment first — so the instalment rows and the
        // loan balance cannot disagree when cover falls short of the balance.
        let left = toLoan;
        const open = await tx.query(
          `SELECT * FROM repayment_schedule WHERE loan_id = ? AND status <> 'paid'
            ORDER BY installment_no`, [loan.id]
        );
        for (const inst of open) {
          if (left <= 0.005) break;
          const owedHere = round2(
            Number(inst.total_due) - Number(inst.principal_paid) - Number(inst.interest_paid)
          );
          const pay = Math.min(left, owedHere);
          const interestOwing = round2(Number(inst.interest_due) - Number(inst.interest_paid));
          const toInterest = Math.min(pay, Math.max(interestOwing, 0));
          const toPrincipal = round2(pay - toInterest);
          const settledHere = pay >= owedHere - 0.005;

          await tx.query(
            `UPDATE repayment_schedule
                SET interest_paid = ?, principal_paid = ?, status = ?, paid_at = ?
              WHERE id = ?`,
            [round2(Number(inst.interest_paid) + toInterest),
             round2(Number(inst.principal_paid) + toPrincipal),
             settledHere ? 'paid' : 'partial',
             settledHere ? new Date() : null,
             inst.id]
          );
          left = round2(left - pay);
        }

        // Read the balance back off the schedule, so the two can never disagree.
        const after = await tx.queryOne(
          `SELECT ROUND(SUM(total_due - principal_paid - interest_paid), 2) AS owing
             FROM repayment_schedule WHERE loan_id = ?`, [loan.id]
        );
        const remainingAfter = Math.max(round2(Number(after.owing) || 0), 0);
        await loanRepository.update(loan.id, {
          amount_paid: round2(Number(loan.amount_paid) + toLoan),
          outstanding_balance: remainingAfter,
          status: remainingAfter <= 0.005 ? 'closed' : 'active',
        }, tx);
      }

      await claimRepository.update(claimId, {
        status: 'settled', loan_settled: toLoan, paid_to_family: surplus,
      }, tx);
      await policyRepository.update(claim.policy_id, { status: 'claimed' }, tx);

      const settled = await claimRepository.findDetailed(claimId, tx);
      publish('insurance.claim_settled', {
        loan, actorId: actor.id, entityId: claimId,
        details: { toLoan, surplus, beneficiaries: split.length },
      });
      return { ...settled, loan_settled: toLoan, paid_to_family: surplus, distribution: split };
    });
  }

  static summary() { return policyRepository.bookSummary(); }
  static policies(filters) { return policyRepository.search(filters); }
  static claims(filters) { return claimRepository.search(filters); }
}

module.exports = InsuranceService;
