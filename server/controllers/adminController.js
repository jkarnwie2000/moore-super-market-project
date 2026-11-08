const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { str, isObjectId, slugify, toMoney, toInt, escapeRegex } = require('../utils/validators');
const { storeImage, removeImage } = require('../middleware/upload');
const InventoryLog = require('../models/InventoryLog');
const env = require('../config/env');
const { setStock } = require('../services/inventoryService');
const { returnUnits, releaseRemainingStock, parseReturnRequest } = require('../services/returnsService');
const { isDateString, startOfLocalDay, addDays } = require('../utils/dates');

/* ----------------------------- Dashboard ----------------------------- */

async function stats(_req, res) {
  const [revenueAgg, paidOrders, pendingFulfilment, productCount, lowStock, customers, recentOrders] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: 'paid', status: { $ne: 'canceled' } } }, { $group: { _id: null, revenue: { $sum: '$total' } } }]),
    Order.countDocuments({ paymentStatus: 'paid', status: { $ne: 'canceled' } }),
    Order.countDocuments({ paymentStatus: 'paid', status: { $in: ['processing', 'ready_for_pickup', 'out_for_delivery'] } }),
    Product.countDocuments(),
    Product.find({ totalStock: { $lte: env.lowStockThreshold } }).sort({ totalStock: 1 }).limit(8).select('name slug totalStock variants image'),
    User.countDocuments({ role: 'customer' }),
    Order.find().sort({ createdAt: -1 }).limit(8),
  ]);
  res.json({
    revenue: revenueAgg[0] ? Math.round(revenueAgg[0].revenue * 100) / 100 : 0,
    paidOrders,
    pendingFulfilment,
    productCount,
    customers,
    lowStock,
    recentOrders,
  });
}

/* ----------------------------- Products ----------------------------- */

const IMAGE_RE = /^(\/uploads\/[\w.-]+|\/images\/[\w./-]+|https:\/\/[^\s"'<>]+)$/;

async function parseProductInput(body, existing) {
  const errors = {};
  const data = {
    name: str(body.name, 120),
    description: str(body.description, 2000),
    brand: str(body.brand, 80),
    origin: str(body.origin, 60),
    image: str(body.image, 500),
    featured: Boolean(body.featured),
    bestSeller: Boolean(body.bestSeller),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 15) : [],
  };
  if (data.name.length < 2) errors.name = 'Name is required.';
  if (data.description.length < 10) errors.description = 'Description must be at least 10 characters.';
  if (!data.brand) errors.brand = 'Brand is required.';
  if (data.image && !IMAGE_RE.test(data.image)) errors.image = 'Image must be an uploaded file or an https:// URL.';

  const rating = body.rating === undefined || body.rating === '' ? 0 : Number(body.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.rating = 'Rating must be 0–5.';
  else data.rating = Math.round(rating * 10) / 10;
  const numReviews = toInt(body.numReviews === undefined || body.numReviews === '' ? 0 : body.numReviews);
  if (numReviews === null) errors.numReviews = 'Review count must be a whole number.';
  else data.numReviews = numReviews;

  if (!isObjectId(body.category)) errors.category = 'Please choose a category.';
  else {
    const category = await Category.findById(body.category);
    if (!category) errors.category = 'Category not found.';
    else {
      data.category = category._id;
      data.region = category.region;
    }
  }

  const rawVariants = Array.isArray(body.variants) ? body.variants.slice(0, 10) : [];
  if (!rawVariants.length) errors.variants = 'Add at least one size with a price and stock quantity.';
  data.variants = rawVariants.map((v, i) => {
    const label = str(v && v.label, 40);
    const price = toMoney(v && v.price);
    const compare = v && v.compareAtPrice !== undefined && v.compareAtPrice !== null && v.compareAtPrice !== '' ? toMoney(v.compareAtPrice) : null;
    const stock = toInt(v && v.stock, { min: 0, max: 100000 });
    if (!label) errors[`variants.${i}.label`] = 'Size label is required.';
    if (price === null || price <= 0) errors[`variants.${i}.price`] = 'Enter a valid price.';
    if (stock === null) errors[`variants.${i}.stock`] = 'Stock must be a whole number ≥ 0.';
    if (compare !== null && price !== null && compare <= price) errors[`variants.${i}.compareAtPrice`] = 'Original price must be higher than the sale price.';
    const out = { label, price, compareAtPrice: compare, stock };
    // Preserve variant IDs on update so existing carts/orders keep referencing them.
    if (existing && isObjectId(v && v._id) && existing.variants.id(v._id)) out._id = v._id;
    return out;
  });

  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);
  return data;
}

async function uniqueSlug(name, ignoreId) {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let n = 2; await Product.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }); n += 1) {
    slug = `${base}-${n}`;
  }
  return slug;
}

async function listProducts(req, res) {
  const filter = {};
  const search = str(req.query.q, 100);
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  if (isObjectId(req.query.category)) filter.category = req.query.category;
  if (req.query.lowStock === '1') filter.totalStock = { $lte: 10 };
  const products = await Product.find(filter).sort({ updatedAt: -1 }).limit(500).populate('category', 'name slug region');
  res.json({ products });
}

async function getProduct(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Product not found.', 404);
  const product = await Product.findById(req.params.id).populate('category', 'name slug region');
  if (!product) throw new AppError('Product not found.', 404);
  res.json({ product });
}

async function createProduct(req, res) {
  const data = await parseProductInput(req.body);
  const product = await Product.create({ ...data, slug: await uniqueSlug(data.name) });
  res.status(201).json({ product });
}

async function updateProduct(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Product not found.', 404);
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);
  const data = await parseProductInput(req.body, product);
  if (data.name !== product.name) product.slug = await uniqueSlug(data.name, product._id);
  const stockBefore = new Map(product.variants.map((v) => [String(v._id), v.stock]));
  product.set(data);
  await product.save();
  // Record stock changes made through the full edit form in the inventory history.
  const logs = product.variants
    .filter((v) => stockBefore.has(String(v._id)) && stockBefore.get(String(v._id)) !== v.stock)
    .map((v) => ({
      product: product._id,
      productName: product.name,
      variantId: v._id,
      variantLabel: v.label,
      change: v.stock - stockBefore.get(String(v._id)),
      stockAfter: v.stock,
      reason: 'adjustment',
      note: 'Edited on the product form',
      user: req.user._id,
      userName: req.user.name,
    }));
  if (logs.length) await InventoryLog.insertMany(logs);
  res.json({ product });
}

/** PATCH /api/admin/products/:id/inventory — quick stock/price update for a single size. */
async function updateInventory(req, res) {
  if (!isObjectId(req.params.id) || !isObjectId(req.body.variantId)) throw new AppError('Product not found.', 404);
  let product = await Product.findById(req.params.id);
  if (!product || !product.variants.id(req.body.variantId)) throw new AppError('Product size not found.', 404);
  let stock;
  let price;
  if (req.body.stock !== undefined) {
    stock = toInt(req.body.stock, { min: 0, max: 100000 });
    if (stock === null) throw new AppError('Stock must be a whole number ≥ 0.', 422);
  }
  if (req.body.price !== undefined) {
    price = toMoney(req.body.price);
    if (price === null || price <= 0) throw new AppError('Enter a valid price.', 422);
  }
  // Stock goes through the atomic, logged path so it can't overwrite a simultaneous sale.
  if (stock !== undefined) {
    const result = await setStock({ productId: product._id, variantId: req.body.variantId, target: stock, note: 'Quick edit on the products list', user: req.user });
    if (!result) throw new AppError('Stock changed while saving — please try again.', 409);
    product = result.product;
  }
  if (price !== undefined && product.variants.id(req.body.variantId).price !== price) {
    product.variants.id(req.body.variantId).price = price;
    await product.save();
  }
  res.json({ product });
}

async function deleteProduct(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Product not found.', 404);
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);
  await removeImage(product.image);
  res.json({ message: 'Product deleted.' });
}

async function uploadImage(req, res) {
  if (!req.file) throw new AppError('Please choose an image to upload.', 400);
  res.status(201).json({ url: await storeImage(req.file) });
}

/* ----------------------------- Categories ----------------------------- */

async function parseCategory(body) {
  const data = {
    name: str(body.name, 80),
    description: str(body.description, 400),
    region: body.region,
    sortOrder: toInt(body.sortOrder === undefined || body.sortOrder === '' ? 0 : body.sortOrder, { min: 0, max: 1000 }) ?? 0,
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Name is required.';
  if (!['african', 'caribbean'].includes(data.region)) errors.region = 'Choose African or Caribbean.';
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);
  return data;
}

async function createCategory(req, res) {
  const data = await parseCategory(req.body);
  const category = await Category.create({ ...data, slug: slugify(data.name) });
  res.status(201).json({ category });
}

async function updateCategory(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Category not found.', 404);
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found.', 404);
  const data = await parseCategory(req.body);
  const regionChanged = data.region !== category.region;
  category.set({ ...data, slug: slugify(data.name) });
  await category.save();
  if (regionChanged) await Product.updateMany({ category: category._id }, { $set: { region: category.region } });
  res.json({ category });
}

async function deleteCategory(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Category not found.', 404);
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse) throw new AppError(`This category still has ${inUse} product(s). Move or delete them first.`, 409);
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found.', 404);
  res.json({ message: 'Category deleted.' });
}

/* ----------------------------- Orders ----------------------------- */

async function listOrders(req, res) {
  const filter = {};
  const { paymentStatus, status } = req.query;
  if (Order.PAYMENT_STATUSES.includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (Order.ORDER_STATUSES.includes(status)) filter.status = status;
  // The sales list shows completed sales only: paid and not cancelled.
  else if (req.query.excludeCanceled === '1') filter.status = { $ne: 'canceled' };
  const search = str(req.query.q, 100);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ orderNumber: rx }, { 'customer.email': rx }, { 'customer.lastName': rx }];
  }
  // Optional date window (store-local calendar days). Paid orders are dated by payment time.
  if (isDateString(req.query.from) || isDateString(req.query.to)) {
    const range = {};
    if (isDateString(req.query.from)) range.$gte = startOfLocalDay(req.query.from, env.storeTimezone);
    if (isDateString(req.query.to)) range.$lt = startOfLocalDay(addDays(req.query.to, 1), env.storeTimezone);
    filter[filter.paymentStatus === 'paid' ? 'paidAt' : 'createdAt'] = range;
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json({ orders });
}

async function getOrder(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found.', 404);
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw new AppError('Order not found.', 404);
  res.json({ order });
}

async function updateOrderStatus(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found.', 404);
  const { status } = req.body;
  if (!Order.ORDER_STATUSES.includes(status)) throw new AppError('Invalid order status.', 422);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found.', 404);
  if (order.paymentStatus !== 'paid' && status !== 'canceled' && status !== 'awaiting_payment') {
    throw new AppError('Only paid orders can be moved into fulfilment.', 409);
  }
  // Stock from a cancelled paid order has already gone back on the shelf, so it can't be reopened.
  if (order.status === 'canceled' && status !== 'canceled' && order.paymentStatus === 'paid' && order.inventoryAdjusted) {
    throw new AppError('A cancelled paid order can’t be reopened because its items were returned to stock. Ask the customer to order again.', 409);
  }

  // Cancelling a paid order puts its items back in stock automatically (unless restock=false).
  if (status === 'canceled' && order.status !== 'canceled' && order.paymentStatus === 'paid') {
    const result = await releaseRemainingStock(order, {
      kind: 'canceled',
      restock: req.body.restock !== false,
      user: req.user,
      extraSet: { status: 'canceled', ...(req.body.resolveReview ? { needsReview: false } : {}) },
    });
    const fresh = await Order.findById(order._id);
    return res.json({ order: fresh, unitsRestocked: result.unitsRestocked, skipped: result.skipped });
  }

  order.status = status;
  if (req.body.resolveReview) {
    order.needsReview = false;
  }
  await order.save();
  res.json({ order, unitsRestocked: 0 });
}

/** POST /api/admin/orders/:id/returns — record items coming back, optionally restocking them. */
async function recordReturn(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found.', 404);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found.', 404);
  const { lines, reason, note } = parseReturnRequest(order, req.body);
  const result = await returnUnits(order, lines, { kind: 'return', reason, note, user: req.user });
  res.status(201).json({ order: result.order, unitsReturned: result.unitsReturned, unitsRestocked: result.unitsRestocked, skipped: result.skipped });
}

/* ----------------------------- Promotions ----------------------------- */

function parsePromotion(body) {
  const errors = {};
  const code = str(body.code, 30).toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) errors.code = 'Use 3–30 letters, numbers, dashes or underscores.';
  const type = body.type;
  if (!['percent', 'fixed'].includes(type)) errors.type = 'Choose percent or fixed amount.';
  const value = toMoney(body.value);
  if (value === null || value <= 0 || (type === 'percent' && value > 100)) errors.value = 'Enter a valid discount value.';
  const minSubtotal = toMoney(body.minSubtotal === undefined || body.minSubtotal === '' ? 0 : body.minSubtotal);
  if (minSubtotal === null) errors.minSubtotal = 'Enter a valid minimum.';
  const usageLimit = toInt(body.usageLimit === undefined || body.usageLimit === '' ? 0 : body.usageLimit);
  if (usageLimit === null) errors.usageLimit = 'Usage limit must be a whole number.';
  let expiresAt = null;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) errors.expiresAt = 'Invalid date.';
  }
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);
  return { code, type, value, minSubtotal, usageLimit, expiresAt, description: str(body.description, 200), active: body.active !== false };
}

async function listPromotions(_req, res) {
  res.json({ promotions: await Promotion.find().sort({ createdAt: -1 }) });
}

async function createPromotion(req, res) {
  const promotion = await Promotion.create(parsePromotion(req.body));
  res.status(201).json({ promotion });
}

async function updatePromotion(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Promotion not found.', 404);
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw new AppError('Promotion not found.', 404);
  promotion.set(parsePromotion(req.body));
  await promotion.save();
  res.json({ promotion });
}

async function deletePromotion(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Promotion not found.', 404);
  const deleted = await Promotion.findByIdAndDelete(req.params.id);
  if (!deleted) throw new AppError('Promotion not found.', 404);
  res.json({ message: 'Promotion deleted.' });
}

module.exports = {
  stats,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateInventory,
  deleteProduct,
  uploadImage,
  createCategory,
  updateCategory,
  deleteCategory,
  listOrders,
  getOrder,
  updateOrderStatus,
  recordReturn,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
