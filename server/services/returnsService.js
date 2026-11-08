const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const { isObjectId, toInt, str } = require('../utils/validators');
const { applyStockChange } = require('./inventoryService');

const round2 = (n) => Math.round((n || 0) * 100) / 100;
const remainingOf = (item) => item.quantity - (item.returnedQuantity || 0);

const LOG_REASON = { return: 'returned', canceled: 'order_canceled', refunded: 'refunded', deleted: 'order_deleted' };
const NOTE = {
  return: (o) => `Returned from ${o.orderNumber}`,
  canceled: (o) => `Order ${o.orderNumber} cancelled`,
  refunded: (o) => `Order ${o.orderNumber} refunded in Stripe`,
  deleted: (o) => `Sale ${o.orderNumber} deleted`,
};

/**
 * Atomically marks units of an order's items as returned (so they can never be counted
 * twice), then puts the `restock` ones back into inventory and logs each movement.
 *
 * `lines` = [{ variantId, quantity, restock }]. The order update only applies if every
 * item's returnedQuantity is still what we read, so a double-click, two admins, or a
 * retried Stripe webhook can't return the same units twice.
 *
 * Returns { order, unitsReturned, unitsRestocked, skipped }.
 */
async function returnUnits(order, lines, { kind, reason = '', note = '', user = null, updateOrder = true, extraSet = {} }) {
  const byVariant = new Map(order.items.map((i) => [String(i.variantId), i]));
  const plan = lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({ ...l, item: byVariant.get(String(l.variantId)) }))
    .filter((l) => l.item);
  if (!plan.length) return { order, unitsReturned: 0, unitsRestocked: 0, skipped: [] };

  const entry = {
    kind,
    reason,
    note,
    userName: user ? user.name : kind === 'refunded' ? 'Stripe' : '',
    items: plan.map((l) => ({
      variantId: l.item.variantId,
      name: l.item.name,
      size: l.item.size,
      quantity: l.quantity,
      restocked: Boolean(l.restock),
      value: round2(l.item.unitPrice * l.quantity),
    })),
  };
  entry.value = round2(entry.items.reduce((s, i) => s + i.value, 0));

  let updated = order;
  if (updateOrder) {
    const inc = {};
    const arrayFilters = [];
    plan.forEach((l, i) => {
      inc[`items.$[i${i}].returnedQuantity`] = l.quantity;
      if (l.restock) inc[`items.$[i${i}].restockedQuantity`] = l.quantity;
      arrayFilters.push({ [`i${i}.variantId`]: l.item.variantId });
    });
    updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        // Orders created before returns existed have no returnedQuantity field: treat missing as 0.
        $and: plan.map((l) => ({
          items: { $elemMatch: { variantId: l.item.variantId, returnedQuantity: l.item.returnedQuantity ? l.item.returnedQuantity : { $in: [0, null] } } },
        })),
      },
      { $inc: inc, $push: { returns: entry }, ...(Object.keys(extraSet).length ? { $set: extraSet } : {}) },
      { arrayFilters, returnDocument: 'after' }
    );
    if (!updated) throw new AppError('This order was just updated by someone else. Refresh and try again.', 409);
  }

  let unitsRestocked = 0;
  const skipped = [];
  for (const l of plan) {
    if (!l.restock) continue;
    const res = await applyStockChange({
      productId: l.item.product,
      variantId: l.item.variantId,
      delta: l.quantity,
      soldDelta: -l.quantity,
      reason: LOG_REASON[kind],
      note: [NOTE[kind](order), note].filter(Boolean).join(' — ').slice(0, 200),
      order,
      user,
    });
    if (res) unitsRestocked += l.quantity;
    else skipped.push(`${l.item.name} (${l.item.size})`); // product or size was deleted
  }

  return { order: updated, unitsReturned: plan.reduce((s, l) => s + l.quantity, 0), unitsRestocked, skipped };
}

/** Puts back every unit of a paid order that hasn't already been returned (cancel / refund / delete). */
async function releaseRemainingStock(order, { kind, restock = true, user = null, note = '', updateOrder = true, extraSet = {} }) {
  if (!order.inventoryAdjusted) {
    if (updateOrder && Object.keys(extraSet).length) await Order.updateOne({ _id: order._id }, { $set: extraSet });
    return { order, unitsReturned: 0, unitsRestocked: 0, skipped: [] };
  }
  const lines = order.items.map((i) => ({ variantId: i.variantId, quantity: remainingOf(i), restock }));
  if (!lines.some((l) => l.quantity > 0)) {
    if (updateOrder && Object.keys(extraSet).length) await Order.updateOne({ _id: order._id }, { $set: extraSet });
    return { order, unitsReturned: 0, unitsRestocked: 0, skipped: [] };
  }
  return returnUnits(order, lines, { kind, reason: kind, note, user, updateOrder, extraSet });
}

const RETURN_REASONS = ['customer_return', 'damaged', 'wrong_item', 'expired', 'other'];

/** Validates an admin "record a return" request against what's still returnable on the order. */
function parseReturnRequest(order, body) {
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded') {
    throw new AppError('Only paid orders can have returns.', 409);
  }
  if (!order.inventoryAdjusted) throw new AppError("This order's stock was never taken, so there is nothing to return.", 409);
  const raw = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  const errors = {};
  const lines = [];
  for (const r of raw) {
    if (!r || !isObjectId(String(r.variantId))) continue;
    const item = order.items.find((i) => String(i.variantId) === String(r.variantId));
    if (!item) continue;
    const quantity = toInt(r.quantity, { min: 0, max: 1000 });
    if (quantity === null) {
      errors[String(r.variantId)] = 'Enter a whole number.';
      continue;
    }
    if (quantity === 0) continue;
    if (quantity > remainingOf(item)) {
      errors[String(r.variantId)] = `Only ${remainingOf(item)} of ${item.name} (${item.size}) can still be returned.`;
      continue;
    }
    lines.push({ variantId: item.variantId, quantity, restock: r.restock !== false });
  }
  if (Object.keys(errors).length) throw new AppError(Object.values(errors)[0], 422, errors);
  if (!lines.length) throw new AppError('Choose at least one item and quantity to return.', 422);
  const reason = RETURN_REASONS.includes(body.reason) ? body.reason : 'customer_return';
  return { lines, reason, note: str(body.note, 200) };
}

const NOT_HANDED_OVER = ['awaiting_payment', 'processing', 'ready_for_pickup', 'out_for_delivery'];

/**
 * Stripe `charge.refunded` webhook. A full refund of an order that hasn't reached the
 * customer yet cancels it and puts its stock back. If the goods were already handed
 * over, or the refund is partial, the order is flagged so staff can record what came back.
 * Safe to receive more than once.
 */
async function applyStripeRefund(charge) {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return null;
  const order = await Order.findOne({ stripePaymentIntentId: paymentIntent });
  if (!order || !['paid', 'refunded'].includes(order.paymentStatus)) return null;

  const refunded = round2((charge.amount_refunded || 0) / 100);
  const full = charge.refunded === true || (charge.amount > 0 && charge.amount_refunded >= charge.amount);
  const base = { amountRefunded: refunded, refundedAt: new Date() };
  const money = (n) => `$${n.toFixed(2)}`;

  if (full && NOT_HANDED_OVER.includes(order.status)) {
    await releaseRemainingStock(order, { kind: 'refunded', extraSet: { ...base, paymentStatus: 'refunded', status: 'canceled' } });
  } else if (full) {
    if (order.paymentStatus !== 'refunded') {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            ...base,
            paymentStatus: 'refunded',
            needsReview: true,
            reviewReason: `Fully refunded in Stripe after the order was ${order.status === 'completed' ? 'completed' : 'cancelled'}. If items came back, use "Record a return" to put them back in stock.`,
          },
        }
      );
    }
  } else if (refunded > (order.amountRefunded || 0)) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          ...base,
          needsReview: true,
          reviewReason: `Partly refunded in Stripe (${money(refunded)} of ${money(order.total)}). If items came back, use "Record a return" to put them back in stock.`,
        },
      }
    );
  }
  return Order.findById(order._id);
}

module.exports = { returnUnits, releaseRemainingStock, parseReturnRequest, applyStripeRefund, remainingOf, RETURN_REASONS };
