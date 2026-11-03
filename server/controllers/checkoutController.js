const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { getStripe } = require('../config/stripe');
const { validateCustomer, str } = require('../utils/validators');
const { computeTotals, pricingConfig } = require('../services/pricingService');
const { buildLineItems, createPendingOrder, markOrderPaid, markOrderUnpaidOutcome, toPublicOrder } = require('../services/orderService');
const { findValidPromotion } = require('../services/promotionService');
const { createCheckoutSession } = require('../services/stripeService');

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

function parseDeliveryMethod(value) {
  if (value !== 'delivery' && value !== 'pickup') {
    throw new AppError('Please choose home delivery or store pickup.', 422, { deliveryMethod: 'Required' });
  }
  return value;
}

/** POST /api/checkout/quote — server-calculated totals (used to preview promo codes). */
async function quote(req, res) {
  const deliveryMethod = req.body.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
  const lines = await buildLineItems(req.body.items);
  const pre = computeTotals(lines, { deliveryMethod });
  const promotion = await findValidPromotion(req.body.promoCode, pre.subtotal);
  const totals = computeTotals(lines, { deliveryMethod, promotion });
  delete totals.cents;
  res.json({
    totals,
    promotion: promotion ? { code: promotion.code, description: promotion.description, type: promotion.type, value: promotion.value } : null,
  });
}

/** POST /api/checkout/session — validates the order, saves it as unpaid, and opens Stripe Checkout. */
async function createSession(req, res) {
  const deliveryMethod = parseDeliveryMethod(req.body.deliveryMethod);
  // Pickup orders still need contact details; address is only required for delivery.
  const customer = validateCustomer(req.body.customer, { requireAddress: deliveryMethod === 'delivery' });

  getStripe(); // Fail fast with a clear 503 before creating an order if Stripe is not configured.

  const { order } = await createPendingOrder({
    items: req.body.items,
    customer,
    deliveryMethod,
    promoCode: req.body.promoCode,
    userId: req.user ? req.user._id : null,
  });

  try {
    const session = await createCheckoutSession(order);
    order.stripeSessionId = session.id;
    await order.save();
    res.status(201).json({ url: session.url, sessionId: session.id, orderNumber: order.orderNumber });
  } catch (err) {
    order.paymentStatus = 'failed';
    order.status = 'canceled';
    order.reviewReason = `Stripe session creation failed: ${err.message}`;
    await order.save();
    throw err;
  }
}

/**
 * GET /api/checkout/session/:sessionId — order details for the confirmation page.
 * Data comes from MongoDB; if the webhook has not arrived yet, the session is
 * verified directly with Stripe's API (never by trusting the URL).
 */
async function getSessionOrder(req, res) {
  const sessionId = str(req.params.sessionId, 255);
  if (!SESSION_ID_RE.test(sessionId)) throw new AppError('Order not found.', 404);

  let order = await Order.findOne({ stripeSessionId: sessionId });
  if (!order) throw new AppError('Order not found.', 404);

  if (order.paymentStatus === 'unpaid') {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata && session.metadata.orderId === order._id.toString()) {
      if (session.payment_status === 'paid') {
        order = await markOrderPaid({
          orderId: order._id,
          sessionId,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          amountTotalCents: session.amount_total,
        });
      } else if (session.status === 'expired') {
        order = (await markOrderUnpaidOutcome(order._id, 'expired')) || order;
      }
    }
  }

  res.json({ order: toPublicOrder(order) });
}

/** POST /api/checkout/cancel — called when the shopper returns from Stripe via "back". */
async function cancelSession(req, res) {
  const sessionId = str(req.body.sessionId, 255);
  if (!SESSION_ID_RE.test(sessionId)) throw new AppError('Invalid session.', 400);
  const order = await Order.findOne({ stripeSessionId: sessionId });
  if (!order || order.paymentStatus !== 'unpaid') return res.json({ canceled: false });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
  if (session.payment_status !== 'paid') await markOrderUnpaidOutcome(order._id, 'canceled');
  res.json({ canceled: session.payment_status !== 'paid' });
}

/** GET /api/config — public storefront configuration (no secrets). */
function publicConfig(_req, res) {
  res.json({
    ...pricingConfig(),
    stripeEnabled: Boolean(env.stripeSecretKey),
    stripePublishableKey: env.stripePublishableKey,
    stripeTestMode: !env.stripeSecretKey || env.stripeSecretKey.startsWith('sk_test_'),
    storeAddress: env.storeAddress,
  });
}

module.exports = { quote, createSession, getSessionOrder, cancelSession, publicConfig, SESSION_ID_RE };
