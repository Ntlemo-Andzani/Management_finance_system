const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const BeneficiaryService = require('../services/BeneficiaryService');

const RELATIONSHIPS = ['spouse', 'child', 'parent', 'sibling', 'other'];

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await BeneficiaryService.list(req.params.clientId) });
});

exports.add = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    full_name: { type: 'string', required: true, minLength: 3, maxLength: 120, label: 'Full name' },
    relationship: { type: 'enum', required: true, values: RELATIONSHIPS, label: 'Relationship' },
    share_pct: { type: 'number', required: true, min: 0.01, max: 100, label: 'Share' },
    national_id: { type: 'string', maxLength: 30 },
    phone: { type: 'string', maxLength: 30 },
    address: { type: 'string', maxLength: 255 },
    date_of_birth: { type: 'date', label: 'Date of birth' },
  });
  const beneficiary = await BeneficiaryService.add(req.params.clientId, data, req.user);
  res.status(201).json({
    success: true, data: beneficiary,
    message: `${beneficiary.full_name} nominated for ${Number(beneficiary.share_pct).toFixed(2)}%`,
  });
});

exports.update = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    full_name: { type: 'string', minLength: 3, maxLength: 120 },
    relationship: { type: 'enum', values: RELATIONSHIPS },
    share_pct: { type: 'number', min: 0.01, max: 100, label: 'Share' },
    national_id: { type: 'string', maxLength: 30 },
    phone: { type: 'string', maxLength: 30 },
    address: { type: 'string', maxLength: 255 },
  });
  const beneficiary = await BeneficiaryService.update(req.params.id, data, req.user);
  res.json({ success: true, data: beneficiary, message: 'Nomination updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  await BeneficiaryService.remove(req.params.id, req.user);
  res.json({ success: true, message: 'Nomination withdrawn' });
});

exports.preview = asyncHandler(async (req, res) => {
  const { amount } = validate(req.query, {
    amount: { type: 'number', required: true, min: 0.01, label: 'Amount' },
  });
  const distribution = await BeneficiaryService.splitPayout(req.params.clientId, amount);
  res.json({ success: true, data: distribution });
});

exports.missing = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await BeneficiaryService.missingNominations() });
});
