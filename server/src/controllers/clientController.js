const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const ClientService = require('../services/ClientService');
const clientRepository = require('../repositories/ClientRepository');

exports.list = asyncHandler(async (req, res) => {
  const data = await clientRepository.search({
    q: req.query.q || '',
    status: req.query.status || '',
    branchId: req.query.branch_id || null,
    limit: req.query.limit || 100,
  });
  res.json({ success: true, data });
});

exports.show = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ClientService.profile(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    first_name: { type: 'string', required: true, minLength: 2, label: 'First name' },
    last_name: { type: 'string', required: true, minLength: 2, label: 'Last name' },
    national_id: { type: 'string', required: true, minLength: 6, maxLength: 30, label: 'ID number' },
    phone: { type: 'string', required: true, minLength: 9, label: 'Phone number' },
    date_of_birth: { type: 'date', label: 'Date of birth' },
    gender: { type: 'enum', values: ['male', 'female', 'other'] },
    email: { type: 'email' },
    address: { type: 'string', maxLength: 255 },
    occupation: { type: 'string', maxLength: 120 },
    business_name: { type: 'string', maxLength: 120 },
    monthly_income: { type: 'number', min: 0, default: 0, label: 'Monthly income' },
    branch_id: { type: 'integer' },
    officer_id: { type: 'integer' },
  });
  const client = await ClientService.register(data, req.user);
  res.status(201).json({ success: true, data: client, message: `${client.first_name} ${client.last_name} registered as ${client.client_no}` });
});

exports.update = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    first_name: { type: 'string', minLength: 2 },
    last_name: { type: 'string', minLength: 2 },
    phone: { type: 'string', minLength: 9 },
    email: { type: 'email' },
    address: { type: 'string', maxLength: 255 },
    occupation: { type: 'string', maxLength: 120 },
    business_name: { type: 'string', maxLength: 120 },
    monthly_income: { type: 'number', min: 0 },
    officer_id: { type: 'integer' },
  });
  res.json({ success: true, data: await ClientService.update(req.params.id, data), message: 'Client updated' });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { status } = validate(req.body, {
    status: { type: 'enum', required: true, values: ['pending', 'active', 'inactive', 'blacklisted'], label: 'Status' },
  });
  const client = await ClientService.setStatus(req.params.id, status);
  res.json({ success: true, data: client, message: `Client set to ${status}` });
});
