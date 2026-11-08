const Product = require('../models/Product');
const Order = require('../models/Order');
const InventoryLog = require('../models/InventoryLog');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { str, isObjectId, toInt } = require('../utils/validators');
const { resolvePeriod } = require('../utils/dates');
const { salesReport, deleteOrder } = require('../services/salesService');
const { applyStockChange, setStock } = require('../services/inventoryService');

/* ------------------------------- Sales ------------------------------- */

/** GET /api/admin/sales?range=7d|30d|90d|12m|ytd  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD */
async function sales(req, res) {
  const period = resolvePeriod(req.query, env.storeTimezone);
  res.json(await salesReport(period, env.storeTimezone));
}

const wantsRestock = (v) => !(v === false || v === 'false' || v === '0' || v === 0);

/** DELETE /api/admin/orders/:id?restock=1 */
async function deleteOne(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found.', 404);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found.', 404);
  const result = await deleteOrder(order, { restock: wantsRestock(req.query.restock), user: req.user });
  res.json({ deleted: [result.orderNumber], unitsReturned: result.unitsReturned, skipped: result.skipped, failed: [] });
}

/** POST /api/admin/orders/delete  { ids: [...], restock: true } */
async function deleteMany(req, res) {
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.filter(isObjectId))] : [];
  if (!ids.length) throw new AppError('Choose at least one sale to delete.', 422);
  if (ids.length > 200) throw new AppError('You can delete up to 200 sales at a time.', 422);
  const restock = wantsRestock(req.body.restock);
  const orders = await Order.find({ _id: { $in: ids } });
  const out = { deleted: [], unitsReturned: 0, skipped: [], failed: [] };
  for (const order of orders) {
    try {
      const r = await deleteOrder(order, { restock, user: req.user });
      out.deleted.push(r.orderNumber);
      out.unitsReturned += r.unitsReturned;
      out.skipped.push(...r.skipped);
    } catch (err) {
      out.failed.push({ orderNumber: order.orderNumber, message: err.message });
    }
  }
  res.json(out);
}

/* ----------------------------- Inventory ----------------------------- */

const stockStatus = (stock) => (stock === 0 ? 'out' : stock <= env.lowStockThreshold ? 'low' : 'ok');

/**
 * GET /api/admin/inventory — one row per product size with stock, status, units sold in
 * the last 30 days and an estimate of how many days the stock will last.
 */
async function inventory(_req, res) {
  const since = new Date(Date.now() - 30 * 86400000);
  const [products, soldRows] = await Promise.all([
    Product.find().sort({ name: 1 }).limit(1000).populate('category', 'name region').lean(),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', paidAt: { $gte: since } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.variantId', quantity: { $sum: '$items.quantity' } } },
    ]),
  ]);
  const sold = new Map(soldRows.map((r) => [String(r._id), r.quantity]));

  const rows = [];
  for (const p of products) {
    for (const v of p.variants) {
      const sold30 = sold.get(String(v._id)) || 0;
      const perDay = sold30 / 30;
      rows.push({
        productId: String(p._id),
        variantId: String(v._id),
        name: p.name,
        brand: p.brand,
        image: p.image,
        slug: p.slug,
        category: p.category ? { id: String(p.category._id), name: p.category.name } : null,
        region: p.region,
        isActive: p.isActive,
        label: v.label,
        price: v.price,
        stock: v.stock,
        status: stockStatus(v.stock),
        sold30,
        daysOfCover: perDay > 0 ? Math.floor(v.stock / perDay) : null,
        stockValue: Math.round(v.stock * v.price * 100) / 100,
      });
    }
  }

  const summary = rows.reduce(
    (s, r) => {
      s.skus += 1;
      s.units += r.stock;
      s.value += r.stockValue;
      if (r.status === 'low') s.low += 1;
      if (r.status === 'out') s.out += 1;
      return s;
    },
    { skus: 0, units: 0, value: 0, low: 0, out: 0 }
  );
  summary.value = Math.round(summary.value * 100) / 100;

  res.json({ rows, summary, lowStockThreshold: env.lowStockThreshold });
}

const ADJUST_REASONS = {
  add: ['restock', 'returned', 'adjustment'],
  remove: ['damaged', 'adjustment'],
  set: ['adjustment', 'restock'],
};

/**
 * POST /api/admin/inventory/adjust
 * { productId, variantId, mode: 'add'|'remove'|'set', quantity, reason, note }
 */
async function adjust(req, res) {
  const { productId, variantId, mode } = req.body;
  if (!isObjectId(productId) || !isObjectId(variantId)) throw new AppError('Product size not found.', 404);
  if (!ADJUST_REASONS[mode]) throw new AppError('Choose add, remove or set.', 422);
  const quantity = toInt(req.body.quantity, { min: mode === 'set' ? 0 : 1, max: 100000 });
  if (quantity === null) {
    throw new AppError(mode === 'set' ? 'Enter a whole number of 0 or more.' : 'Enter a whole number of 1 or more.', 422, { quantity: 'Invalid quantity' });
  }
  const reason = ADJUST_REASONS[mode].includes(req.body.reason) ? req.body.reason : ADJUST_REASONS[mode][0];
  const note = str(req.body.note, 200);

  let result;
  if (mode === 'set') {
    result = await setStock({ productId, variantId, target: quantity, reason, note, user: req.user });
  } else {
    result = await applyStockChange({ productId, variantId, delta: mode === 'add' ? quantity : -quantity, reason, note, user: req.user });
    if (!result && mode === 'remove') {
      const product = await Product.findById(productId);
      const variant = product && product.variants.id(variantId);
      if (variant) throw new AppError(`Only ${variant.stock} in stock — you can't remove ${quantity}.`, 409);
    }
  }
  if (!result) throw new AppError('Product size not found.', 404);

  res.json({
    productId,
    variantId,
    stock: result.variant.stock,
    status: stockStatus(result.variant.stock),
    totalStock: result.product.totalStock,
    log: result.log,
    unchanged: Boolean(result.unchanged),
  });
}

/** GET /api/admin/inventory/history?productId=&variantId=&reason=&limit=&before= */
async function history(req, res) {
  const filter = {};
  if (isObjectId(req.query.productId)) filter.product = req.query.productId;
  if (isObjectId(req.query.variantId)) filter.variantId = req.query.variantId;
  if (InventoryLog.REASONS.includes(req.query.reason)) filter.reason = req.query.reason;
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  const limit = toInt(req.query.limit, { min: 1, max: 200 }) || 50;
  const logs = await InventoryLog.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
  res.json({ logs: logs.slice(0, limit), hasMore: logs.length > limit });
}

module.exports = { sales, deleteOne, deleteMany, inventory, adjust, history };
