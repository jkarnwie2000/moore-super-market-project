const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { getStripe } = require('../config/stripe');
const { addDays, startOfLocalDay } = require('../utils/dates');
const { applyStockChange } = require('./inventoryService');

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// A sale is a paid order, dated by when payment was received.
const paidBetween = (start, end) => ({ paymentStatus: 'paid', paidAt: { $gte: start, $lt: end } });

async function summarise(start, end) {
  const [row] = await Order.aggregate([
    { $match: paidBetween(start, end) },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        grossSales: { $sum: '$total' },
        productSales: { $sum: '$subtotal' },
        discounts: { $sum: '$discount' },
        tax: { $sum: '$tax' },
        deliveryFees: { $sum: '$deliveryFee' },
        itemsSold: { $sum: { $sum: '$items.quantity' } },
      },
    },
  ]);
  const r = row || { orders: 0, grossSales: 0, productSales: 0, discounts: 0, tax: 0, deliveryFees: 0, itemsSold: 0 };
  return {
    orders: r.orders,
    grossSales: round2(r.grossSales),
    netSales: round2(r.productSales - r.discounts),
    discounts: round2(r.discounts),
    tax: round2(r.tax),
    deliveryFees: round2(r.deliveryFees),
    itemsSold: r.itemsSold,
    averageOrder: r.orders ? round2(r.grossSales / r.orders) : 0,
  };
}

/** Every bucket key in the period, so days/months without sales still appear as zero. */
function bucketKeys(from, to, bucket) {
  const keys = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = bucket === 'month' ? d.slice(0, 7) : d;
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

/**
 * Sales report for a resolved period (see utils/dates.resolvePeriod): headline totals,
 * the same totals for the preceding period of equal length, a revenue series, top
 * products, and splits by category and fulfilment method.
 */
async function salesReport(period, tz = env.storeTimezone) {
  const { from, to, start, end, days } = period;
  const prevFrom = addDays(from, -days);
  const prevStart = startOfLocalDay(prevFrom, tz);
  const bucket = days > 92 ? 'month' : 'day';
  const match = { $match: paidBetween(start, end) };

  const [summary, previous, seriesRows, topProducts, byCategory, byFulfilment] = await Promise.all([
    summarise(start, end),
    summarise(prevStart, start),
    Order.aggregate([
      match,
      {
        $group: {
          _id: { $dateToString: { date: '$paidAt', format: bucket === 'month' ? '%Y-%m' : '%Y-%m-%d', timezone: tz } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      match,
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $last: '$items.name' },
          image: { $last: '$items.image' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1, quantity: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      match,
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p', pipeline: [{ $project: { category: 1 } }] } },
      { $lookup: { from: 'categories', localField: 'p.category', foreignField: '_id', as: 'c', pipeline: [{ $project: { name: 1 } }] } },
      {
        $group: {
          _id: { $ifNull: [{ $first: '$c.name' }, 'Uncategorised'] },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([match, { $group: { _id: '$deliveryMethod', orders: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
  ]);

  const byKey = new Map(seriesRows.map((r) => [r._id, r]));
  const series = bucketKeys(from, to, bucket).map((key) => ({
    key,
    revenue: round2(byKey.get(key)?.revenue),
    orders: byKey.get(key)?.orders || 0,
  }));

  return {
    period: { from, to, days, bucket, timezone: tz, previousFrom: prevFrom, previousTo: addDays(from, -1) },
    summary,
    previous,
    series,
    topProducts: topProducts.map((p) => ({ productId: p._id, name: p.name, image: p.image, quantity: p.quantity, revenue: round2(p.revenue) })),
    byCategory: byCategory.map((c) => ({ name: c._id, quantity: c.quantity, revenue: round2(c.revenue) })),
    byFulfilment: ['delivery', 'pickup'].map((m) => {
      const row = byFulfilment.find((r) => r._id === m);
      return { method: m, orders: row ? row.orders : 0, revenue: round2(row && row.revenue) };
    }),
  };
}

/**
 * Makes sure an unpaid order's Stripe Checkout page can no longer take payment, so a
 * customer can't pay for an order that has been deleted.
 */
async function closeOpenCheckout(order) {
  if (order.paymentStatus === 'paid' || !order.stripeSessionId || !env.stripeSecretKey) return;
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return; // Stripe not configured (or live key blocked) — nothing can be paid.
  }
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  } catch (err) {
    if (err && err.code === 'resource_missing') return;
    throw new AppError(`Couldn't reach Stripe to close the checkout for ${order.orderNumber}. Please try again.`, 502);
  }
  if (!session) return;
  if (session.status === 'complete') {
    throw new AppError(`${order.orderNumber} has just been paid in Stripe. Refresh the page — it can't be deleted as an unpaid order.`, 409);
  }
  if (session.status === 'open') {
    try {
      await stripe.checkout.sessions.expire(order.stripeSessionId);
    } catch {
      throw new AppError(`Couldn't close the Stripe checkout for ${order.orderNumber}. Please try again.`, 502);
    }
  }
}

/**
 * Permanently deletes an order (a "sale"). For paid orders whose stock was already
 * taken, `restock` puts those units back on the shelf and logs the return.
 * Deleting never refunds the customer — that is done in the Stripe dashboard.
 */
async function deleteOrder(order, { restock = true, user = null } = {}) {
  await closeOpenCheckout(order);

  let unitsReturned = 0;
  const skipped = [];
  if (restock && order.inventoryAdjusted) {
    for (const item of order.items) {
      const res = await applyStockChange({
        productId: item.product,
        variantId: item.variantId,
        delta: item.quantity,
        soldDelta: -item.quantity,
        reason: 'order_deleted',
        note: `Sale ${order.orderNumber} deleted`,
        order,
        user,
      });
      if (res) unitsReturned += item.quantity;
      else skipped.push(`${item.name} (${item.size})`);
    }
  }
  if (order.paymentStatus === 'paid' && order.promoCode) {
    await Promotion.updateOne({ code: order.promoCode, timesUsed: { $gt: 0 } }, { $inc: { timesUsed: -1 } });
  }
  await Order.deleteOne({ _id: order._id });
  return { orderNumber: order.orderNumber, unitsReturned, skipped };
}

module.exports = { salesReport, deleteOrder };
