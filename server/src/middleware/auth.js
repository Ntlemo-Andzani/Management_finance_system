/**
 * Authentication and role-based access control.
 * Every /api route except /auth/login and /health passes through requireAuth.
 */
const AuthService = require('../services/AuthService');
const ApiError = require('../utils/ApiError');

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Sign in to continue'));
  try {
    req.user = AuthService.verify(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

/** requireRole('admin','manager') */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action is limited to: ${roles.join(', ')}`));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
