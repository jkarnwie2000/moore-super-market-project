const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || '',
  // On Vercel, default to the project's production domain so Stripe redirects work without extra config.
  clientUrl: (
    process.env.CLIENT_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:5173'
  ).replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  // Safety switch: live keys (sk_live_...) are refused unless this is explicitly "true".
  stripeLiveModeEnabled: process.env.STRIPE_LIVE_MODE_ENABLED === 'true',
  currency: (process.env.CURRENCY || 'usd').toLowerCase(),
  taxRate: toNumber(process.env.TAX_RATE, 0.07),
  deliveryFee: toNumber(process.env.DELIVERY_FEE, 7.99),
  freeDeliveryThreshold: toNumber(process.env.FREE_DELIVERY_THRESHOLD, 75),
  storeAddress: process.env.STORE_ADDRESS || 'Moore Supermarket, 1200 Market Street',
  // Transactional email (password resets) via Resend — https://resend.com. Without an API key,
  // reset links are only printed to the server log (fine for local development).
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Moore Supermarket <onboarding@resend.dev>',
  // Sales reports group by calendar day in the store's local time zone.
  storeTimezone: process.env.STORE_TIMEZONE || 'America/New_York',
  // A product size at or below this many units is flagged "low stock".
  lowStockThreshold: toNumber(process.env.LOW_STOCK_THRESHOLD, 10),
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (!env.jwtSecret) {
  if (env.isProduction) {
    throw new Error('JWT_SECRET must be set in production.');
  }
  env.jwtSecret = 'dev-only-insecure-jwt-secret-change-me';
}

module.exports = env;
