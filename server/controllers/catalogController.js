const Product = require('../models/Product');
const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const { str, escapeRegex, isObjectId } = require('../utils/validators');

const SORTS = {
  price_asc: { price: 1, name: 1 },
  price_desc: { price: -1, name: 1 },
  popular: { sold: -1, rating: -1 },
  rating: { rating: -1, numReviews: -1 },
  newest: { createdAt: -1 },
  name: { name: 1 },
};

const q = (req, key, max = 100) => str(req.query[key], max);

async function listProducts(req, res) {
  const filter = { isActive: true };

  const search = q(req, 'q');
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { tags: rx }];
  }

  const region = q(req, 'region');
  if (region === 'african' || region === 'caribbean') filter.region = region;

  const categorySlug = q(req, 'category');
  let category = null;
  if (categorySlug) {
    category = await Category.findOne({ slug: categorySlug.toLowerCase() });
    if (!category) return res.json({ products: [], total: 0, page: 1, pages: 0, category: null });
    filter.category = category._id;
  }

  const min = Number(q(req, 'minPrice'));
  const max = Number(q(req, 'maxPrice'));
  if (q(req, 'minPrice') && Number.isFinite(min)) filter.price = { ...(filter.price || {}), $gte: min };
  if (q(req, 'maxPrice') && Number.isFinite(max)) filter.price = { ...(filter.price || {}), $lte: max };

  if (q(req, 'featured') === '1') filter.featured = true;
  if (q(req, 'deals') === '1') filter.onSale = true;
  if (q(req, 'bestSeller') === '1') filter.bestSeller = true;
  if (q(req, 'inStock') === '1') filter.totalStock = { $gt: 0 };

  const sort = SORTS[q(req, 'sort')] || SORTS.popular;
  const limit = Math.min(Math.max(parseInt(q(req, 'limit'), 10) || 24, 1), 100);
  const page = Math.max(parseInt(q(req, 'page'), 10) || 1, 1);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ ...sort, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name slug region'),
    Product.countDocuments(filter),
  ]);

  res.json({ products, total, page, pages: Math.ceil(total / limit), category });
}

async function getProduct(req, res) {
  const key = str(req.params.slug, 120).toLowerCase();
  const query = isObjectId(key) ? { _id: key } : { slug: key };
  const product = await Product.findOne({ ...query, isActive: true }).populate('category', 'name slug region');
  if (!product) throw new AppError('Product not found.', 404);

  const related = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    $or: [{ category: product.category._id }, { region: product.region, featured: true }],
  })
    .sort({ sold: -1 })
    .limit(4)
    .populate('category', 'name slug region');

  res.json({ product, related });
}

async function listCategories(_req, res) {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ region: 1, sortOrder: 1, name: 1 }),
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ categories: categories.map((c) => ({ ...c.toJSON(), productCount: countMap.get(String(c._id)) || 0 })) });
}

/** Returns current price/stock for cart lines so the client can refresh a persisted cart. */
async function validateCart(req, res) {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 60) : [];
  const ids = items.map((i) => i && i.productId).filter(isObjectId);
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = items.map((i) => {
    const product = byId.get(i && i.productId);
    const variant = product && isObjectId(i.variantId) ? product.variants.id(i.variantId) : null;
    if (!product || !product.isActive || !variant) {
      return { productId: i && i.productId, variantId: i && i.variantId, available: false, stock: 0 };
    }
    return {
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      available: variant.stock > 0,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      image: product.image,
      size: variant.label,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      stock: variant.stock,
    };
  });
  res.json({ items: lines });
}

module.exports = { listProducts, getProduct, listCategories, validateCart };
