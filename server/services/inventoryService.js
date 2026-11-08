const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const { isObjectId } = require('../utils/validators');

/**
 * Atomically changes one product size's stock by `delta` and records the movement.
 *
 * - A negative delta only applies if enough stock exists (never goes below zero).
 * - `expectStock` makes the update conditional on the current value (used by "set to N"
 *   so a sale that lands at the same moment is never silently overwritten).
 * - `soldDelta` keeps the product's lifetime "sold" counter in step with sales.
 *
 * Returns { product, variant, log } or null when the product/size is missing, stock is
 * insufficient, or `expectStock` no longer matches.
 */
async function applyStockChange({ productId, variantId, delta, reason, note = '', order = null, user = null, expectStock, soldDelta = 0 }) {
  if (!isObjectId(String(productId)) || !isObjectId(String(variantId)) || !Number.isInteger(delta)) return null;

  const match = { _id: variantId };
  if (expectStock !== undefined) match.stock = expectStock;
  else if (delta < 0) match.stock = { $gte: -delta };

  const inc = { 'variants.$.stock': delta, totalStock: delta };
  if (soldDelta) inc.sold = soldDelta;

  const product = await Product.findOneAndUpdate(
    { _id: productId, variants: { $elemMatch: match } },
    { $inc: inc },
    { returnDocument: 'after' }
  );
  if (!product) return null;

  const variant = product.variants.id(variantId);
  const log = await InventoryLog.create({
    product: product._id,
    productName: product.name,
    variantId,
    variantLabel: variant.label,
    change: delta,
    stockAfter: variant.stock,
    reason,
    note: String(note || '').slice(0, 200),
    order: order ? order._id : null,
    orderNumber: order ? order.orderNumber : '',
    user: user ? user._id : null,
    userName: user ? user.name : '',
  });
  return { product, variant, log };
}

/**
 * Sets a size's stock to an exact number, logging the difference. Retries if a sale
 * changes the stock between reading and writing. Returns the same shape as
 * applyStockChange, with `unchanged: true` when the stock already equals `target`.
 */
async function setStock({ productId, variantId, target, reason = 'adjustment', note, user }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const product = await Product.findById(productId);
    const variant = product && product.variants.id(variantId);
    if (!variant) return null;
    const delta = target - variant.stock;
    if (delta === 0) return { product, variant, log: null, unchanged: true };
    const result = await applyStockChange({ productId, variantId, delta, reason, note, user, expectStock: variant.stock });
    if (result) return result;
  }
  return null;
}

module.exports = { applyStockChange, setStock };
