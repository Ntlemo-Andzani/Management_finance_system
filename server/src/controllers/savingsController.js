const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const SavingsService = require('../services/SavingsService');
const savingsRepository = require('../repositories/SavingsRepository');

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await savingsRepository.listWithClients({ q: req.query.q || '' }) });
});

exports.open = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    client_id: { type: 'integer', required: true, label: 'Client' },
    interest_rate: { type: 'number', min: 0, max: 100, default: 4.5, label: 'Interest rate' },
    opening_deposit: { type: 'number', min: 0, default: 0, label: 'Opening deposit' },
  });
  const account = await SavingsService.open(data, req.user);
  res.status(201).json({ success: true, data: account, message: `Account ${account.account_no} opened` });
});

exports.post = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    account_id: { type: 'integer', required: true, label: 'Account' },
    type: { type: 'enum', required: true, values: ['deposit', 'withdrawal', 'interest', 'fee'], label: 'Transaction type' },
    amount: { type: 'number', required: true, min: 0.01, label: 'Amount' },
    txn_date: { type: 'date' },
    reference: { type: 'string', maxLength: 60 },
    notes: { type: 'string', maxLength: 255 },
  });
  const account = await SavingsService.post(data, req.user);
  res.json({ success: true, data: account, message: `${data.type} posted — new balance R${Number(account.balance).toFixed(2)}` });
});

exports.statement = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await SavingsService.statement(req.params.id) });
});
