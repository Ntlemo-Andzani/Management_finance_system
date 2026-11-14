/**
 * LoanService — the loan life cycle.
 *
 *   pending -> approved -> active (disbursed) -> closed
 *           -> rejected                        -> defaulted / written_off
 *
 * Acts as a FACADE over the repositories, the ScheduleFactory and the EventBus so
 * controllers stay thin.
 */
const db = require('../config/db');
const loanRepository = require('../repositories/LoanRepository');
const scheduleRepository = require('../repositories/ScheduleRepository');
const clientRepository = require('../repositories/ClientRepository');
const { loanProductRepository } = require('../repositories/SupportRepositories');
const { ScheduleFactory } = require('./interest/ScheduleFactory');
const InsuranceService = require('./InsuranceService');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');

class LoanService {
  /** Quote a loan without saving anything — used by the "Preview schedule" button. */
  static quote({ principal, productId, termMonths, product }) {
    const p = product;
    const schedule = ScheduleFactory.create({
      principal,
      annualRate: p.interest_rate,
      termMonths,
      frequency: p.repayment_frequency,
      method: p.interest_method,
      startDate: new Date(),
    });
    const processingFee = round2(principal * (p.processing_fee_pct / 100));
    const insurance = InsuranceService.quote({
      principal, termMonths, product: p, totalPayable: schedule.totals.totalPayable,
    });

    return {
      product: { id: p.id, name: p.name, rate: p.interest_rate, method: p.interest_method },
      processingFee,
      insurance,
      // What the client actually walks out with once the deductions come off.
      netDisbursement: round2(principal - processingFee - insurance.premium),
      ...schedule,
    };
  }

  static async preview({ product_id, principal, term_months }) {
    const product = await loanProductRepository.findById(product_id);
    if (!product) throw ApiError.notFound('That loan product no longer exists');
    LoanService._assertWithinProductLimits(product, principal, term_months);
    return LoanService.quote({ principal, productId: product_id, termMonths: term_months, product });
  }

  static _assertWithinProductLimits(product, principal, termMonths) {
    const errors = {};
    if (principal < Number(product.min_amount) || principal > Number(product.max_amount)) {
      errors.principal = `${product.name} lends between R${product.min_amount} and R${product.max_amount}`;
    }
    if (termMonths < product.min_term_months || termMonths > product.max_term_months) {
      errors.term_months = `${product.name} runs for ${product.min_term_months}–${product.max_term_months} months`;
    }
    if (Object.keys(errors).length) throw ApiError.badRequest('The application does not fit this product', errors);
  }

  /** Step 1 — capture an application. Nothing is scheduled until disbursement. */
  static async apply(payload, actor) {
    const client = await clientRepository.findById(payload.client_id);
    if (!client) throw ApiError.notFound('Client not found');
    if (client.status === 'blacklisted') throw ApiError.forbidden('This client is blacklisted and cannot borrow');
    if (client.status !== 'active') throw ApiError.badRequest('Activate the client profile before capturing a loan');

    const product = await loanProductRepository.findById(payload.product_id);
    if (!product || !product.is_active) throw ApiError.notFound('Loan product not available');
    LoanService._assertWithinProductLimits(product, payload.principal, payload.term_months);

    const openLoans = await loanRepository.findWhere(
      "client_id = ? AND status IN ('pending','approved','active')", [payload.client_id]
    );
    if (openLoans.length) throw ApiError.conflict('This client already has an open loan or application');

    return db.transaction(async (tx) => {
      const loanNo = await loanRepository.nextLoanNo(tx);
      const id = await loanRepository.create({
        loan_no: loanNo,
        client_id: payload.client_id,
        product_id: product.id,
        officer_id: actor.id,
        branch_id: client.branch_id,
        principal: payload.principal,
        interest_rate: product.interest_rate,
        interest_method: product.interest_method,
        repayment_frequency: product.repayment_frequency,
        term_months: payload.term_months,
        purpose: payload.purpose || null,
        application_date: payload.application_date || new Date().toISOString().slice(0, 10),
        processing_fee: round2(payload.principal * (product.processing_fee_pct / 100)),
        status: 'pending',
      }, tx);

      for (const g of payload.guarantors || []) {
        await tx.query(
          `INSERT INTO loan_guarantors (loan_id, full_name, national_id, phone, relationship, address)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, g.full_name, g.national_id || null, g.phone || null, g.relationship || null, g.address || null]
        );
      }
      for (const c of payload.collateral || []) {
        await tx.query(
          'INSERT INTO loan_collateral (loan_id, description, estimated_value) VALUES (?, ?, ?)',
          [id, c.description, c.estimated_value || 0]
        );
      }

      const loan = await loanRepository.findDetailed(id, tx);
      publish('loan.applied', { loan, actorId: actor.id, details: { principal: payload.principal } });
      return loan;
    });
  }

  /** Step 2 — credit decision. Manager or admin only (enforced in the route). */
  static async approve(loanId, actor) {
    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'pending') throw ApiError.conflict(`Only pending applications can be approved (this one is ${loan.status})`);
    if (loan.officer_id === actor.id && actor.role !== 'admin') {
      throw ApiError.forbidden('A loan cannot be approved by the officer who captured it');
    }

    await loanRepository.update(loanId, {
      status: 'approved',
      approved_by: actor.id,
      approved_at: new Date(),
    });

    const updated = await loanRepository.findDetailed(loanId);
    publish('loan.approved', { loan: updated, actorId: actor.id });
    return updated;
  }

  static async reject(loanId, reason, actor) {
    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'pending') throw ApiError.conflict('Only pending applications can be rejected');

    await loanRepository.update(loanId, {
      status: 'rejected',
      approved_by: actor.id,
      approved_at: new Date(),
      rejection_reason: reason,
    });
    const updated = await loanRepository.findDetailed(loanId);
    publish('loan.rejected', { loan: updated, reason, actorId: actor.id });
    return updated;
  }

  /**
   * Step 3 — release the money and generate the repayment schedule.
   * Everything happens in one transaction: either the loan becomes active with a
   * full schedule, or nothing is written at all.
   */
  static async disburse(loanId, { disbursement_date }, actor) {
    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'approved') throw ApiError.conflict('Only approved loans can be disbursed');

    const startDate = disbursement_date || new Date().toISOString().slice(0, 10);

    return db.transaction(async (tx) => {
      const { installments, totals } = ScheduleFactory.create({
        principal: Number(loan.principal),
        annualRate: Number(loan.interest_rate),
        termMonths: loan.term_months,
        frequency: loan.repayment_frequency,
        method: loan.interest_method,
        startDate,
      });

      await scheduleRepository.createMany(loanId, installments, tx);

      // Credit life cover is issued here, in the same transaction as the
      // schedule, so a loan can never go live with a premium deducted and no
      // policy on file.
      const product = await loanProductRepository.findById(loan.product_id, tx);
      const policy = await InsuranceService.issueForLoan(
        loan, product, startDate, totals.totalPayable, tx);

      await loanRepository.update(loanId, {
        status: 'active',
        disbursed_at: `${startDate} 09:00:00`,
        installments: totals.installments,
        total_interest: totals.totalInterest,
        total_payable: totals.totalPayable,
        outstanding_balance: totals.totalPayable,
        first_due_date: totals.firstDueDate,
        maturity_date: totals.maturityDate,
        insurance_premium: policy ? policy.premium : 0,
      }, tx);

      const updated = await loanRepository.findDetailed(loanId, tx);
      publish('loan.disbursed', { loan: updated, actorId: actor.id, details: { ...totals, policy } });
      return { ...updated, policy };
    });
  }

  static async writeOff(loanId, reason, actor) {
    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'active') throw ApiError.conflict('Only active loans can be written off');
    await loanRepository.update(loanId, { status: 'written_off', rejection_reason: reason });
    const updated = await loanRepository.findDetailed(loanId);
    publish('loan.written_off', { loan: updated, actorId: actor.id, details: { reason } });
    return updated;
  }

  static async detail(loanId) {
    const loan = await loanRepository.findDetailed(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    const [schedule, guarantors, collateral] = await Promise.all([
      scheduleRepository.forLoan(loanId),
      db.query('SELECT * FROM loan_guarantors WHERE loan_id = ?', [loanId]),
      db.query('SELECT * FROM loan_collateral WHERE loan_id = ?', [loanId]),
    ]);
    return { ...loan, schedule, guarantors, collateral };
  }
}

module.exports = LoanService;
