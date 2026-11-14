/** Application-level error carrying an HTTP status code. */
class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
  static badRequest(msg, details)   { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Sign in to continue')      { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have access to this action') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found')                    { return new ApiError(404, msg); }
  static conflict(msg)              { return new ApiError(409, msg); }
}
module.exports = ApiError;
