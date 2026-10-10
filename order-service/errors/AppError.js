class AppError extends Error {
  constructor(code, message, statusCode, options = {}) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
