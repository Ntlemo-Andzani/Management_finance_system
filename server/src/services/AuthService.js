/** AuthService — password verification and JWT issuing. */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/UserRepository');
const ApiError = require('../utils/ApiError');

class AuthService {
  static async login(email, password) {
    const user = await userRepository.findByEmail(String(email).toLowerCase());
    // Same message either way so the form cannot be used to discover valid emails.
    if (!user) throw ApiError.unauthorized('Email or password is incorrect');
    if (!user.is_active) throw ApiError.forbidden('This account has been deactivated. Ask an administrator to restore it.');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw ApiError.unauthorized('Email or password is incorrect');

    await userRepository.touchLogin(user.id);
    const payload = { id: user.id, role: user.role, branchId: user.branch_id, name: user.full_name };
    const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

    return {
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, branch_id: user.branch_id },
    };
  }

  static async createUser(data) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw ApiError.conflict('That email address is already registered');
    const password_hash = await bcrypt.hash(data.password, 10);
    const id = await userRepository.create({ ...data, password_hash });
    return userRepository.findById(id);
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) throw ApiError.badRequest('Your current password is incorrect');
    const password_hash = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password_hash });
    return true;
  }

  static verify(token) {
    try {
      return jwt.verify(token, env.jwt.secret);
    } catch {
      throw ApiError.unauthorized('Your session has expired. Sign in again.');
    }
  }
}

module.exports = AuthService;
