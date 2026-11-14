const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/**
 * Database faults are an operator problem, not a user problem. The person at the
 * counter is told the system is unavailable; the detail — including anything that
 * would reveal usernames, hosts or file paths — goes to the server console only.
 */
const DB_FAULTS = {
  ECONNREFUSED:               'The system cannot reach its database. Ask your administrator to check that MySQL is running.',
  ER_ACCESS_DENIED_ERROR:     'The system cannot sign in to its database. Ask your administrator to check the database credentials.',
  ER_BAD_DB_ERROR:            'The system database has not been created yet. Ask your administrator to run the setup scripts.',
  ER_NOT_SUPPORTED_AUTH_MODE: 'The system cannot authenticate against its database. Ask your administrator to check the database user.',
  PROTOCOL_CONNECTION_LOST:   'The connection to the database was lost. Try again in a moment.',
  ETIMEDOUT:                  'The database did not respond in time. Try again in a moment.',
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong on our side';
  const details = err.details || null;

  // Constraint violations become messages a teller can act on.
  if (err.code === 'ER_DUP_ENTRY') { status = 409; message = 'That record already exists'; }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') { status = 400; message = 'A linked record in this form does not exist'; }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') { status = 409; message = 'This record is still in use elsewhere and cannot be removed'; }

  // Infrastructure faults: one safe sentence out, full detail to the console.
  if (DB_FAULTS[err.code]) {
    status = 503;
    message = DB_FAULTS[err.code];
    console.error(`\n[database] ${err.code}: ${err.message}`);
    console.error('[database] Check server/.env — DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.\n');
  } else if (status >= 500) {
    console.error('[error]', err);
  }

  // The response never carries a stack trace, an internal path or a driver
  // message, in any environment. Unexpected 500s are deliberately vague.
  if (status >= 500 && !DB_FAULTS[err.code]) {
    message = 'Something went wrong on our side. The problem has been logged.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
  });
}

module.exports = { notFound, errorHandler };
