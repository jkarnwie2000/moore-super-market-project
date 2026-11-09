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

// Password-reset emails: few per hour, so the form can't be used to spam someone's inbox.
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { message: 'Too many reset requests. Please try again in an hour.' },
});

module.exports = { authLimiter, checkoutLimiter, resetLimiter };
