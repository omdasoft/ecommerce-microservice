const AppError = require('../errors/AppError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const isExpectedError = error instanceof AppError;
  const statusCode = isExpectedError ? error.statusCode : 500;
  const code = isExpectedError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isExpectedError
    ? error.message
    : 'An unexpected error occurred';

  if (!isExpectedError || statusCode >= 500) {
    console.error('Order service request failed:', error);
  }

  res.status(statusCode).json({ error: message, code });
}

module.exports = errorHandler;
