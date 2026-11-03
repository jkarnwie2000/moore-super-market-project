const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const Product = require('./models/Product');
const { seedDatabase } = require('./data/seed');

async function start() {
  const { inMemory } = await connectDB();

  // Auto-seed an empty database in development so the store is usable immediately.
  if (!env.isProduction && (await Product.estimatedDocumentCount()) === 0) {
    await seedDatabase({ log: true });
    if (inMemory) console.log('[seed] Demo data loaded into the in-memory database.');
  }

  if (!env.stripeSecretKey) {
    console.warn('[stripe] STRIPE_SECRET_KEY is not set — checkout will return 503 until it is configured.');
  } else if (!env.stripeWebhookSecret) {
    console.warn('[stripe] STRIPE_WEBHOOK_SECRET is not set — webhooks will be rejected (orders still reconcile on the confirmation page).');
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] Moore Supermarket API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
