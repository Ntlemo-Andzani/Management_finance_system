const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const RepaymentService = require('../services/RepaymentService');
const repaymentRepository = require('../repositories/RepaymentRepository');

exports.statement = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await RepaymentService.statement(req.params.loanId) });
});

exports.record = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    loan_id: { type: 'integer', required: true, label: 'Loan' },
    amount: { type: 'number', required: true, min: 0.01, label: 'Amount' },
    payment_date: { type: 'date', label: 'Payment date' },
    method: { type: 'enum', values: ['cash', 'bank', 'mobile_money'], default: 'cash', label: 'Method' },
    reference: { type: 'string', maxLength: 60 },
    notes: { type: 'string', maxLength: 255 },
  });
  const receipt = await RepaymentService.record(data, req.user);
  res.status(201).json({ success: true, data: receipt, message: `Receipt ${receipt.receipt_no} issued` });
});

exports.forLoan = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await repaymentRepository.forLoan(req.params.loanId) });
});

exports.recent = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await repaymentRepository.recent({ from: req.query.from, to: req.query.to, limit: req.query.limit || 100 }),
  });
});
