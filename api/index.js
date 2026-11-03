/**
 * Vercel serverless entry point. Every /api/* request is routed here (see vercel.json)
 * and handled by the same Express app used in local development.
 */
const { createApp } = require('../server/app');
const { connectDB } = require('../server/config/db');

let app = null;
let ready = null;

async function init() {
  await connectDB();
  // First-launch convenience: load the sample catalogue into an empty database.
  if (process.env.AUTO_SEED === 'true') {
    const Product = require('../server/models/Product');
    if ((await Product.estimatedDocumentCount()) === 0) {
      const { seedDatabase } = require('../server/data/seed');
      await seedDatabase({ log: true });
    }
  }
}

module.exports = async (req, res) => {
  try {
    ready = ready || init();
    await ready;
  } catch (err) {
    ready = null; // retry on the next request
    console.error('[startup]', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message: /MONGODB_URI/.test(err.message)
          ? 'The store database is not configured yet (MONGODB_URI).'
          : 'The store is temporarily unavailable. Please try again shortly.',
      })
    );
    return;
  }
  app = app || createApp();
  return app(req, res);
};
