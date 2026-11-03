class AppError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}
module.exports = AppError;
