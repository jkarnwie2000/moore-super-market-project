const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const { stripeWebhook } = require('./controllers/webhookController');
const { sanitizeBody } = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          // Allow https product images (admin-entered URLs) and Google Fonts; payments redirect to Stripe's hosted page.
          'img-src': ["'self'", 'data:', 'https:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'connect-src': ["'self'"],
          'upgrade-insecure-requests': env.isProduction && env.clientUrl.startsWith('https://') ? [] : null,
        },
      },
    })
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));

  // Stripe webhooks need the exact raw bytes for signature verification,
  // so this route is registered BEFORE the JSON body parser.
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));
  app.use('/api', routes);

  // In production, serve the built React app from the same origin.
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (env.isProduction && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
