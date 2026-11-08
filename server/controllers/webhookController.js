const env = require('../config/env');
const { getStripe } = require('../config/stripe');
const ProcessedEvent = require('../models/ProcessedEvent');
const { markOrderPaid, markOrderUnpaidOutcome } = require('../services/orderService');
const { applyStripeRefund } = require('../services/returnsService');

const paymentIntentId = (session) =>
  typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

async function handleEvent(event) {
  const session = event.data.object;
  const orderId = session.metadata && session.metadata.orderId;

  switch (event.type) {
    case 'checkout.session.completed':
      // For card payments payment_status is "paid" here. Delayed methods (e.g. bank debits)
      // arrive later via async_payment_succeeded/failed.
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        await markOrderPaid({ orderId, sessionId: session.id, paymentIntentId: paymentIntentId(session), amountTotalCents: session.amount_total });
      }
      break;
    case 'checkout.session.async_payment_succeeded':
      await markOrderPaid({ orderId, sessionId: session.id, paymentIntentId: paymentIntentId(session), amountTotalCents: session.amount_total });
      break;
    case 'checkout.session.async_payment_failed':
      await markOrderUnpaidOutcome(orderId, 'failed');
      break;
    case 'checkout.session.expired':
      await markOrderUnpaidOutcome(orderId, 'expired');
      break;
    case 'charge.refunded':
      // Here event.data.object is a Charge, not a Checkout Session.
      await applyStripeRefund(event.data.object);
      break;
    default:
      // Other event types are acknowledged but not used.
      break;
  }
}

/**
 * POST /api/webhooks/stripe — must receive the RAW body (mounted before express.json()).
 */
async function stripeWebhook(req, res) {
  if (!env.stripeWebhookSecret) {
    return res.status(503).json({ message: 'STRIPE_WEBHOOK_SECRET is not configured.' });
  }
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    if (!env.isTest) console.warn('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ message: `Webhook signature verification failed.` });
  }

  // Duplicate delivery of an already-handled event: acknowledge and stop.
  if (await ProcessedEvent.exists({ eventId: event.id })) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event); // idempotent even if two deliveries race
    await ProcessedEvent.updateOne({ eventId: event.id }, { $setOnInsert: { eventId: event.id, type: event.type } }, { upsert: true });
  } catch (err) {
    console.error('[webhook] Failed to process event', event.id, err);
    // Non-2xx tells Stripe to retry later.
    return res.status(500).json({ message: 'Webhook processing failed.' });
  }
  res.json({ received: true });
}

module.exports = { stripeWebhook, handleEvent };
