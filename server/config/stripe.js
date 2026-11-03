const Stripe = require('stripe');
const env = require('./env');

let client = null;

/** Returns a configured Stripe client, or throws a clear configuration error. */
function getStripe() {
  if (client) return client;
  const key = env.stripeSecretKey;
  if (!key) {
    const err = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your .env file.');
    err.status = 503;
    throw err;
  }
  if (key.startsWith('sk_live_') && !env.stripeLiveModeEnabled) {
    const err = new Error('Live Stripe keys are disabled. Set STRIPE_LIVE_MODE_ENABLED=true to accept real payments.');
    err.status = 503;
    throw err;
  }
  client = new Stripe(key);
  return client;
}

/** Test hook: inject a mock Stripe client. */
function setStripeClient(mock) {
  client = mock;
}

module.exports = { getStripe, setStripeClient };
