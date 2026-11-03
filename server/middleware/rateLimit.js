const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const skip = () => env.isTest;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { message: 'Too many checkout attempts. Please wait a moment.' },
});

module.exports = { authLimiter, checkoutLimiter };
