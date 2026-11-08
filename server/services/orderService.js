const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const AppError = require('../utils/AppError');
const { isObjectId, toInt } = require('../utils/validators');
const { computeTotals } = require('./pricingService');
const { findValidPromotion } = require('./promotionService');
const { applyStockChange } = require('./inventoryService');

const MAX_LINE_QTY = 99;
const MAX_LINES = 60;

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MS-${ymd}-${rand}`;
}

/**
 * Turns untrusted cart input ([{productId, variantId, quantity}]) into priced order
 * lines using ONLY database prices and stock. Any client-sent price is ignored.
 */
async function buildLineItems(rawItems, { includeInactive = false } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new AppError('Your cart is empty.', 422);
  if (rawItems.length > MAX_LINES) throw new AppError('Too many items in cart.', 422);

  // Merge duplicate lines.
  const merged = new Map();
  for (const raw of rawItems) {
    const productId = raw && raw.productId;
    const variantId = raw && raw.variantId;
    const quantity = toInt(raw && raw.quantity, { min: 1, max: MAX_LINE_QTY });
    if (!isObjectId(productId) || !isObjectId(variantId) || quantity === null) {
      throw new AppError('Your cart contains an invalid item.', 422);
    }
    const key = `${productId}:${variantId}`;
    const prev = merged.get(key);
    merged.set(key, { productId, variantId, quantity: (prev ? prev.quantity : 0) + quantity });
  }

  const ids = [...new Set([...merged.values()].map((i) => i.productId))];
  // Staff at the till may sell products that are hidden from the website.
  const products = await Product.find({ _id: { $in: ids }, ...(includeInactive ? {} : { isActive: true }) });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = [];
  const problems = [];
  for (const { productId, variantId, quantity } of merged.values()) {
    const product = byId.get(productId);
    const variant = product && product.variants.id(variantId);
    if (!product || !variant) {
      problems.push({ productId, variantId, message: 'This item is no longer available.' });
      continue;
    }
    if (variant.stock < quantity) {
      problems.push({
        productId,
        variantId,
        available: variant.stock,
        message:
          variant.stock === 0
            ? `${product.name} (${variant.label}) is out of stock.`
            : `Only ${variant.stock} of ${product.name} (${variant.label}) available.`,
      });
      continue;
    }
    lines.push({
      product: product._id,
      variantId: variant._id,
      name: product.name,
      brand: product.brand,
      image: product.image,
      size: variant.label,
      unitPrice: variant.price,
      quantity,
      lineTotal: Math.round(variant.price * 100 * quantity) / 100,
    });
  }

  if (problems.length) {
    throw new AppError(problems.map((p) => p.message).join(' '), 409, { items: problems });
  }
  return lines;
}

/** Builds and persists an unpaid order. */
async function createPendingOrder({ items, customer, deliveryMethod, promoCode, userId }) {
  const lines = await buildLineItems(items);
  const preTotals = computeTotals(lines, { deliveryMethod });
  const promotion = await findValidPromotion(promoCode, preTotals.subtotal);
  const totals = computeTotals(lines, { deliveryMethod, promotion });

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: userId || null,
    customer,
    deliveryMethod,
    items: lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    promoCode: promotion ? promotion.code : '',
    deliveryFee: totals.deliveryFee,
    tax: totals.tax,
    total: totals.total,
  });
  return { order, totals, promotion };
}

/**
 * Marks an order paid exactly once and decrements inventory. Safe to call
 * repeatedly (webhook retries, confirmation-page reconciliation): the
 * conditional update guarantees only the first caller performs side effects.
 */
async function markOrderPaid({ orderId, sessionId, paymentIntentId, amountTotalCents }) {
  if (!isObjectId(String(orderId))) return null;
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stripeSessionId: sessionId, paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus: 'paid',
        status: 'processing',
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId || '',
        amountPaid: Math.round(amountTotalCents) / 100,
      },
    },
    { returnDocument: 'after' }
  );

  if (!order) {
    // Already processed (or unknown order) — return current state without side effects.
    return Order.findOne({ _id: orderId, stripeSessionId: sessionId });
  }

  const reviewReasons = [];
  if (Math.round(order.total * 100) !== Math.round(amountTotalCents)) {
    reviewReasons.push(`Amount mismatch: expected ${order.total}, Stripe charged ${amountTotalCents / 100}.`);
  }

  for (const item of order.items) {
    const res = await applyStockChange({
      productId: item.product,
      variantId: item.variantId,
      delta: -item.quantity,
      soldDelta: item.quantity,
      reason: 'sale',
      order,
    });
    if (!res) {
      reviewReasons.push(`Insufficient stock to fulfil ${item.name} (${item.size}) x${item.quantity}.`);
    }
  }

  if (order.promoCode) {
    await Promotion.updateOne({ code: order.promoCode }, { $inc: { timesUsed: 1 } });
  }

  order.inventoryAdjusted = true;
  if (reviewReasons.length) {
    order.needsReview = true;
    order.reviewReason = reviewReasons.join(' ');
  }
  await order.save();
  return order;
}

/** Moves an unpaid order to a terminal non-paid state (never overrides a paid order). */
async function markOrderUnpaidOutcome(orderId, paymentStatus) {
  if (!isObjectId(String(orderId))) return null;
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $in: ['unpaid', 'failed'] } },
    { $set: { paymentStatus, status: 'canceled' } },
    { returnDocument: 'after' }
  );
}

/** Customer-facing view of an order (no internal review notes or Stripe IDs). */
function toPublicOrder(order) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customer: order.customer,
    deliveryMethod: order.deliveryMethod,
    items: order.items.map((i) => ({
      product: i.product.toString(),
      name: i.name,
      brand: i.brand,
      image: i.image,
      size: i.size,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    promoCode: order.promoCode,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    amountPaid: order.amountPaid,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    status: order.status,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  };
}

module.exports = { buildLineItems, createPendingOrder, markOrderPaid, markOrderUnpaidOutcome, toPublicOrder, generateOrderNumber };
