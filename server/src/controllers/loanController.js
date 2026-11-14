const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const LoanService = require('../services/LoanService');
const loanRepository = require('../repositories/LoanRepository');
const { loanProductRepository } = require('../repositories/SupportRepositories');

exports.products = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await loanProductRepository.active() });
});

exports.list = asyncHandler(async (req, res) => {
  const data = await loanRepository.search({
    status: req.query.status || '',
    clientId: req.query.client_id || null,
    q: req.query.q || '',
    limit: req.query.limit || 200,
  });
  res.json({ success: true, data });
});

exports.show = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await LoanService.detail(req.params.id) });
});

exports.preview = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    product_id: { type: 'integer', required: true, label: 'Loan product' },
    principal: { type: 'number', required: true, min: 1, label: 'Amount' },
    term_months: { type: 'integer', required: true, min: 1, label: 'Term' },
  });
  res.json({ success: true, data: await LoanService.preview(data) });
});

exports.apply = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    client_id: { type: 'integer', required: true, label: 'Client' },
    product_id: { type: 'integer', required: true, label: 'Loan product' },
    principal: { type: 'number', required: true, min: 1, label: 'Amount' },
    term_months: { type: 'integer', required: true, min: 1, label: 'Term' },
    purpose: { type: 'string', maxLength: 255, label: 'Purpose' },
    application_date: { type: 'date' },
  });
  data.guarantors = Array.isArray(req.body.guarantors) ? req.body.guarantors : [];
  data.collateral = Array.isArray(req.body.collateral) ? req.body.collateral : [];
  const loan = await LoanService.apply(data, req.user);
  res.status(201).json({ success: true, data: loan, message: `Application ${loan.loan_no} sent for approval` });
});

exports.approve = asyncHandler(async (req, res) => {
  const loan = await LoanService.approve(req.params.id, req.user);
  res.json({ success: true, data: loan, message: `${loan.loan_no} approved` });
});

exports.reject = asyncHandler(async (req, res) => {
  const { reason } = validate(req.body, {
    reason: { type: 'string', required: true, minLength: 5, maxLength: 255, label: 'Reason' },
  });
  const loan = await LoanService.reject(req.params.id, reason, req.user);
  res.json({ success: true, data: loan, message: `${loan.loan_no} rejected` });
});

exports.disburse = asyncHandler(async (req, res) => {
  const data = validate(req.body, { disbursement_date: { type: 'date', label: 'Disbursement date' } });
  const loan = await LoanService.disburse(req.params.id, data, req.user);
  res.json({ success: true, data: loan, message: `${loan.loan_no} disbursed — schedule generated` });
});

exports.writeOff = asyncHandler(async (req, res) => {
  const { reason } = validate(req.body, { reason: { type: 'string', required: true, minLength: 5, label: 'Reason' } });
  const loan = await LoanService.writeOff(req.params.id, reason, req.user);
  res.json({ success: true, data: loan, message: `${loan.loan_no} written off` });
});
