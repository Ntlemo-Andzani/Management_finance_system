const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const AuthService = require('../services/AuthService');
const userRepository = require('../repositories/UserRepository');

exports.login = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, minLength: 6, label: 'Password' },
  });
  const result = await AuthService.login(data.email, data.password);
  res.json({ success: true, ...result });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  res.json({
    success: true,
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, branch_id: user.branch_id },
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    current_password: { type: 'string', required: true, label: 'Current password' },
    new_password: { type: 'string', required: true, minLength: 8, label: 'New password' },
  });
  await AuthService.changePassword(req.user.id, data.current_password, data.new_password);
  res.json({ success: true, message: 'Password changed' });
});

exports.listUsers = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await userRepository.listWithBranch() });
});

exports.createUser = asyncHandler(async (req, res) => {
  const data = validate(req.body, {
    full_name: { type: 'string', required: true, minLength: 3, label: 'Full name' },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, minLength: 8, label: 'Password' },
    role: { type: 'enum', required: true, values: ['admin', 'manager', 'officer', 'teller'], label: 'Role' },
    branch_id: { type: 'integer', required: true, label: 'Branch' },
    phone: { type: 'string', maxLength: 30 },
  });
  const user = await AuthService.createUser(data);
  res.status(201).json({ success: true, data: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
});

exports.setUserActive = asyncHandler(async (req, res) => {
  await userRepository.update(req.params.id, { is_active: req.body.is_active ? 1 : 0 });
  res.json({ success: true, message: req.body.is_active ? 'User restored' : 'User deactivated' });
});
