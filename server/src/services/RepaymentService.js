/**
 * RepaymentService — receipting and allocation.
 *
 * A payment is applied to the oldest unpaid instalment first, and within an
 * instalment in the order: penalty -> interest -> principal. Any surplus rolls
 * forward to the next instalment, so a client may settle early in one payment.
 */
const db = require('../config/db');
const loanRepository = require('../repositories/LoanRepository');
const scheduleRepository = require('../repositories/ScheduleRepository');
const repaymentRepository = require('../repositories/RepaymentRepository');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');

class RepaymentService {
  /**
   * Penalty on an overdue instalment: penalty_rate_pct of the unpaid amount for
   * every full period the instalment is late (capped at the instalment value so a
   * forgotten loan can never balloon past a defensible figure).
   */
  static calculatePenalty(installment, penaltyRatePct, asOfDate = new Date()) {
    if (!penaltyRatePct) return 0;
    const due = new Date(installment.due_date);
    const days = Math.floor((asOfDate - due) / 86400000);
    if (days <= 0) return 0;
    const unpaid = round2(
      Number(installment.total_due) - Number(installment.principal_paid) - Number(installment.interest_paid)
    );
    if (unpaid <= 0) return 0;
    const periodsLate = Math.ceil(days / 30);
    const penalty = round2(unpaid * (Number(penaltyRatePct) / 100) * periodsLate);
    return Math.min(penalty, unpaid);
  }

  /** What the client should pay today, including any penalty that has accrued. */
  static async statement(loanId) {
    const loan = await loanRepository.findDetailed(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');

    const outstanding = await scheduleRepository.outstandingForLoan(loanId);
    const today = new Date();
    let dueNow = 0;
    let penaltyNow = 0;

    for (const inst of outstanding) {
      if (new Date(inst.due_date) <= today) {
        const paid = Number(inst.principal_paid) + Number(inst.interest_paid);
        dueNow = round2(dueNow + Number(inst.total_due) - paid);
        penaltyNow = round2(
          penaltyNow + RepaymentService.calculatePenalty(inst, loan.penalty_rate_pct, today)
                     - Number(inst.penalty_paid)
        );
      }
    }

    const penalty = Math.max(penaltyNow, 0);

    return {
      loan_no: loan.loan_no,
      client_name: loan.client_name,
      status: loan.status,
      outstanding_balance: Number(loan.outstanding_balance),
      instalments_remaining: outstanding.length,
      amount_due_now: Math.max(dueNow, 0),
      penalty_due_now: penalty,
      total_due_now: Math.max(round2(dueNow + penalty), 0),
      next_due_date: outstanding.length ? outstanding[0].due_date : null,
      // Settling today means clearing the balance AND every penalty already
      // charged, otherwise the quote understates what the teller must collect.
      payoff_amount: round2(Number(loan.outstanding_balance) + penalty),
    };
  }

  /** Record a payment. Runs as one transaction across three tables. */
  static async record({ loan_id, amount, payment_date, method, reference, notes }, actor) {
    const loan = await loanRepository.findDetailed(loan_id);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'active') throw ApiError.conflict(`Payments can only be posted to active loans (this one is ${loan.status})`);
    if (amount <= 0) throw ApiError.badRequest('Enter an amount greater than zero');

    const paidOn = payment_date || new Date().toISOString().slice(0, 10);

    return db.transaction(async (tx) => {
      const installments = await scheduleRepository.outstandingForLoan(loan_id, tx);
      let remaining = round2(amount);
      let principalTotal = 0;
      let interestTotal = 0;
      let penaltyTotal = 0;
      const asOf = new Date(paidOn);

      for (const inst of installments) {
        if (remaining <= 0) break;

        // 1. penalty
        const accrued = RepaymentService.calculatePenalty(inst, loan.penalty_rate_pct, asOf);
        const penaltyOwing = round2(Math.max(accrued - Number(inst.penalty_paid), 0));
        const penaltyPay = Math.min(remaining, penaltyOwing);
        remaining = round2(remaining - penaltyPay);

        // 2. interest
        const interestOwing = round2(Number(inst.interest_due) - Number(inst.interest_paid));
        const interestPay = Math.min(remaining, Math.max(interestOwing, 0));
        remaining = round2(remaining - interestPay);

        // 3. principal
        const principalOwing = round2(Number(inst.principal_due) - Number(inst.principal_paid));
        const principalPay = Math.min(remaining, Math.max(principalOwing, 0));
        remaining = round2(remaining - principalPay);

        if (penaltyPay + interestPay + principalPay === 0) continue;

        const newPenaltyPaid = round2(Number(inst.penalty_paid) + penaltyPay);
        const newInterestPaid = round2(Number(inst.interest_paid) + interestPay);
        const newPrincipalPaid = round2(Number(inst.principal_paid) + principalPay);
        const settled = newInterestPaid >= Number(inst.interest_due) - 0.005
                     && newPrincipalPaid >= Number(inst.principal_due) - 0.005
                     && newPenaltyPaid >= accrued - 0.005;

        await tx.query(
          `UPDATE repayment_schedule
              SET principal_paid = ?, interest_paid = ?, penalty_paid = ?, penalty_due = ?,
                  status = ?, paid_at = ?
            WHERE id = ?`,
          [newPrincipalPaid, newInterestPaid, newPenaltyPaid, accrued,
           settled ? 'paid' : 'partial', settled ? `${paidOn} 12:00:00` : null, inst.id]
        );

        principalTotal = round2(principalTotal + principalPay);
        interestTotal = round2(interestTotal + interestPay);
        penaltyTotal = round2(penaltyTotal + penaltyPay);
      }

      const applied = round2(principalTotal + interestTotal + penaltyTotal);
      if (applied <= 0) throw ApiError.badRequest('Nothing is outstanding on this loan');
      const overpayment = round2(amount - applied);

      const receiptNo = await repaymentRepository.nextReceiptNo(tx);
      const repaymentId = await repaymentRepository.create({
        receipt_no: receiptNo,
        loan_id,
        amount: applied,
        principal_component: principalTotal,
        interest_component: interestTotal,
        penalty_component: penaltyTotal,
        payment_date: paidOn,
        method: method || 'cash',
        received_by: actor.id,
        reference: reference || null,
        notes: overpayment > 0 ? `${notes || ''} (R${overpayment.toFixed(2)} returned to client — loan settled)`.trim() : notes || null,
      }, tx);

      // amount_paid is the cash received, penalties included. The balance is a
      // different quantity: what is still owed on principal and interest. It is
      // read back off the schedule rather than derived from the cash figure,
      // because a penalty is an extra charge and must not discount the loan.
      const newPaid = round2(Number(loan.amount_paid) + applied);
      const owing = await tx.queryOne(
        `SELECT ROUND(SUM(total_due - principal_paid - interest_paid), 2) AS owing
           FROM repayment_schedule WHERE loan_id = ?`, [loan_id]
      );
      const newBalance = Math.max(round2(Number(owing.owing) || 0), 0);
      const settledLoan = newBalance <= 0.005;

      await loanRepository.update(loan_id, {
        amount_paid: newPaid,
        outstanding_balance: newBalance,
        status: settledLoan ? 'closed' : 'active',
      }, tx);

      const receipt = {
        id: repaymentId,
        receipt_no: receiptNo,
        loan_no: loan.loan_no,
        client_name: loan.client_name,
        amount: applied,
        overpayment_returned: overpayment,
        principal_component: principalTotal,
        interest_component: interestTotal,
        penalty_component: penaltyTotal,
        payment_date: paidOn,
        method: method || 'cash',
        balance_after: newBalance,
        loan_status: settledLoan ? 'closed' : 'active',
      };

      publish('repayment.recorded', { loan, repayment: receipt, actorId: actor.id });
      if (settledLoan) publish('loan.closed', { loan, actorId: actor.id });
      return receipt;
    });
  }
}

module.exports = RepaymentService;
