const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const InsuranceService = require('../services/InsuranceService');

exports.summary = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await InsuranceService.summary() });
});

exports.policies = asyncHandler(async (req, res) => {
  const data = await InsuranceService.policies({
    status: req.query.status || '', q: req.query.q || '', limit: req.query.limit || 200,
  });
  res.json({ success: true, data });
});

exports.policy = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await InsuranceService.detail(req.params.id) });
});

exports.claims = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await InsuranceService.claims({ status: req.query.status || '' }) });
});

exports.lodge = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    policy_id: { type: 'integer', required: true, label: 'Policy' },
    claim_type: {
      type: 'enum', required: true,
      values: ['death', 'permanent_disability', 'retrenchment'], label: 'Claim type',
    },
    incident_date: { type: 'date', required: true, label: 'Date of incident' },
    notes: { type: 'string', maxLength: 255 },
  });
  const claim = await InsuranceService.lodgeClaim(data, req.user);
  res.status(201).json({ success: true, data: claim, message: `Claim ${claim.claim_no} lodged` });
});

exports.assess = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    decision: { type: 'enum', required: true, values: ['approve', 'reject'], label: 'Decision' },
    approved_amount: { type: 'number', min: 0, label: 'Approved amount' },
    notes: { type: 'string', maxLength: 255 },
  });
  const claim = await InsuranceService.assessClaim(req.params.id, data, req.user);
  res.json({
    success: true, data: claim,
    message: `Claim ${claim.claim_no} ${data.decision === 'approve' ? 'approved' : 'rejected'}`,
  });
});

exports.settle = asyncHandler(async (req, res) => {
  const claim = await InsuranceService.settleClaim(req.params.id, req.user);
  res.json({
    success: true, data: claim,
    message: `Claim ${claim.claim_no} settled — loan cleared, surplus to the family`,
  });
});
