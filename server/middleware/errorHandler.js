const multer = require('multer');
const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    message = 'Please correct the highlighted fields.';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier.';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use.`;
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 3 MB or smaller.' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  } else if (err.type && String(err.type).startsWith('Stripe')) {
    status = 502;
    message = 'Payment provider error. Please try again.';
    if (!env.isTest) console.error('[stripe]', err.message);
  }

  if (status === 503 && !env.isTest) console.warn(`[503] ${message}`);
  else if (status >= 500 && !env.isTest) console.error(err);
  if (status >= 500 && env.isProduction && status !== 502 && status !== 503) message = 'Internal server error.';

  res.status(status).json({ message, ...(details ? { errors: details } : {}) });
}

module.exports = { notFound, errorHandler };
