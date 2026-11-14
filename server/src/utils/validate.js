/**
 * Tiny schema validator — keeps the dependency list short while still giving
 * every endpoint consistent, readable error messages.
 *
 *   validate(req.body, { principal: { type: 'number', required: true, min: 1 } })
 */
const ApiError = require('./ApiError');

function validate(payload = {}, schema = {}) {
  const errors = {};
  const clean = {};

  for (const [field, rule] of Object.entries(schema)) {
    let value = payload[field];

    if (value === undefined || value === null || value === '') {
      if (rule.required) errors[field] = `${rule.label || field} is required`;
      else if (rule.default !== undefined) clean[field] = rule.default;
      continue;
    }

    if (rule.type === 'number') {
      value = Number(value);
      if (Number.isNaN(value)) { errors[field] = `${rule.label || field} must be a number`; continue; }
      if (rule.min !== undefined && value < rule.min) errors[field] = `${rule.label || field} must be at least ${rule.min}`;
      if (rule.max !== undefined && value > rule.max) errors[field] = `${rule.label || field} may not exceed ${rule.max}`;
    } else if (rule.type === 'integer') {
      value = Number(value);
      if (!Number.isInteger(value)) { errors[field] = `${rule.label || field} must be a whole number`; continue; }
      if (rule.min !== undefined && value < rule.min) errors[field] = `${rule.label || field} must be at least ${rule.min}`;
    } else if (rule.type === 'email') {
      value = String(value).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = 'Enter a valid email address';
    } else if (rule.type === 'date') {
      if (Number.isNaN(Date.parse(value))) errors[field] = `${rule.label || field} must be a valid date`;
      value = String(value).slice(0, 10);
    } else if (rule.type === 'enum') {
      value = String(value);
      if (!rule.values.includes(value)) errors[field] = `${rule.label || field} must be one of: ${rule.values.join(', ')}`;
    } else {
      value = String(value).trim();
      if (rule.minLength && value.length < rule.minLength) errors[field] = `${rule.label || field} must be at least ${rule.minLength} characters`;
      if (rule.maxLength && value.length > rule.maxLength) errors[field] = `${rule.label || field} may not exceed ${rule.maxLength} characters`;
      if (rule.pattern && !rule.pattern.test(value)) errors[field] = rule.message || `${rule.label || field} is not in the expected format`;
    }

    clean[field] = value;
  }

  if (Object.keys(errors).length) throw ApiError.badRequest('Check the highlighted fields', errors);
  return clean;
}

module.exports = validate;
