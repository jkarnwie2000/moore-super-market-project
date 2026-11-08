const Order = require('../models/Order');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const InventoryLog = require('../models/InventoryLog');
const AppError = require('../utils/AppError');
const { str, toMoney } = require('../utils/validators');
const { buildLineItems, generateOrderNumber } = require('./orderService');
const { computeTotals } = require('./pricingService');
const { findValidPromotion } = require('./promotionService');
const { applyStockChange } = require('./inventoryService');

const PAYMENT_METHODS = ['cash', 'card', 'mobile_money', 'other'];
const METHOD_LABEL = { cash: 'cash', card: 'card', mobile_money: 'mobile money', other: 'other payment' };

/** Prices a till ticket from the database (no delivery fee; hidden products allowed). */
async function quoteInStore({ items, promoCode }) {
  const lines = await buildLineItems(items, { includeInactive: true });
  const pre = computeTotals(lines, { deliveryMethod: 'pickup' });
  const promotion = promoCode ? await findValidPromotion(promoCode, pre.subtotal) : null;
  const totals = computeTotals(lines, { deliveryMethod: 'pickup', promotion });
  return { lines, totals, promotion };
}

/**
 * Records a sale made at the till: a paid, completed order on the "in_store" channel.
 * Stock is taken atomically per item; if any item has run out in the meantime, every
 * change already made is undone and nothing is recorded.
 */
async function createInStoreSale(body, user) {
  const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : null;
  if (!paymentMethod) throw new AppError('Choose how the customer paid.', 422, { paymentMethod: 'Required' });

  const { lines, totals, promotion } = await quoteInStore({ items: body.items, promoCode: str(body.promoCode, 30) });

  let amountTendered = null;
  let changeGiven = null;
  if (paymentMethod === 'cash') {
    amountTendered = toMoney(body.amountTendered);
    if (amountTendered === null) amountTendered = totals.total; // exact cash
    if (Math.round(amountTendered * 100) < totals.cents.total) {
      throw new AppError(`Cash received ($${amountTendered.toFixed(2)}) is less than the total ($${totals.total.toFixed(2)}).`, 422, { amountTendered: 'Too little' });
    }
    changeGiven = Math.round(amountTendered * 100 - totals.cents.total) / 100;
  }

  const customerName = str(body.customerName, 80);
  const [firstName, ...rest] = customerName ? customerName.split(/\s+/) : ['Walk-in', 'customer'];
  const now = new Date();
  const order = new Order({
    orderNumber: `IS-${generateOrderNumber().slice(3)}`,
    channel: 'in_store',
    deliveryMethod: 'in_store',
    customer: { firstName, lastName: rest.join(' '), email: str(body.customerEmail, 120), phone: str(body.customerPhone, 30) },
    items: lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    promoCode: promotion ? promotion.code : '',
    deliveryFee: 0,
    tax: totals.tax,
    total: totals.total,
    paymentMethod,
    amountTendered,
    changeGiven,
    paymentStatus: 'paid',
    status: 'completed',
    paidAt: now,
    amountPaid: totals.total,
    inventoryAdjusted: true,
    soldBy: user ? user.name : '',
    note: str(body.note, 200),
  });

  await order.validate(); // fail before touching stock if anything about the receipt is invalid

  const done = [];
  for (const line of lines) {
    const res = await applyStockChange({
      productId: line.product,
      variantId: line.variantId,
      delta: -line.quantity,
      soldDelta: line.quantity,
      reason: 'in_store_sale',
      note: `In-store sale, paid by ${METHOD_LABEL[paymentMethod]}`,
      order,
      user,
    });
    if (!res) {
      // Undo silently: this sale never happened, so it leaves no trace in the history.
      for (const d of done) {
        await Product.updateOne(
          { _id: d.line.product, 'variants._id': d.line.variantId },
          { $inc: { 'variants.$.stock': d.line.quantity, totalStock: d.line.quantity, sold: -d.line.quantity } }
        );
        await InventoryLog.deleteOne({ _id: d.log._id });
      }
      const product = await Product.findById(line.product);
      const left = product && product.variants.id(line.variantId) ? product.variants.id(line.variantId).stock : 0;
      throw new AppError(`Only ${left} of ${line.name} (${line.size}) left in stock — the sale was not recorded.`, 409);
    }
    done.push({ line, log: res.log });
  }

  await order.save();
  if (promotion) await Promotion.updateOne({ _id: promotion._id }, { $inc: { timesUsed: 1 } });
  return order;
}

module.exports = { quoteInStore, createInStoreSale, PAYMENT_METHODS };
