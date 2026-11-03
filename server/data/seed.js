const env = require('../config/env');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const User = require('../models/User');
const { slugify } = require('../utils/validators');
const catalog = require('./catalog');

const variant = ([label, price, compareAtPrice, stock]) => ({ label, price, compareAtPrice, stock });

/**
 * Loads categories, products, promotions and demo accounts.
 * Existing catalogue data is replaced; users/orders are kept (demo users are upserted).
 */
async function seedDatabase({ log = false } = {}) {
  const say = (...args) => log && console.log('[seed]', ...args);

  await Promise.all([Category.deleteMany({}), Product.deleteMany({}), Promotion.deleteMany({})]);

  const categories = await Category.insertMany(catalog.categories.map((c, i) => ({ ...c, sortOrder: i })));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  say(`${categories.length} categories`);

  const docs = catalog.products.map((prod) => {
    const category = bySlug.get(prod.category);
    if (!category) throw new Error(`Unknown category ${prod.category} for ${prod.name}`);
    const slug = slugify(prod.name);
    const doc = new Product({
      name: prod.name,
      slug,
      brand: prod.brand,
      origin: prod.origin,
      description: prod.description,
      category: category._id,
      region: category.region,
      image: `/images/products/${slug}.svg`,
      variants: prod.variants.map(variant),
      rating: prod.rating ?? 4.5,
      numReviews: prod.numReviews ?? 10,
      sold: prod.sold ?? 0,
      featured: Boolean(prod.featured),
      bestSeller: Boolean(prod.bestSeller),
      tags: prod.tags || [],
    });
    doc.syncDerived();
    return doc;
  });
  await Product.insertMany(docs);
  say(`${docs.length} products`);

  await Promotion.insertMany([
    { code: 'WELCOME10', type: 'percent', value: 10, description: '10% off your first order', minSubtotal: 0 },
    { code: 'JERK5', type: 'fixed', value: 5, description: '$5 off orders over $40', minSubtotal: 40 },
    { code: 'HARVEST15', type: 'percent', value: 15, description: '15% off orders over $100', minSubtotal: 100 },
  ]);
  say('3 promotions (WELCOME10, JERK5, HARVEST15)');

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@mooresupermarket.com').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (env.isProduction ? '' : 'MooreAdmin123');
  if (adminPassword) {
    const admin = (await User.findOne({ email: adminEmail })) || new User({ email: adminEmail, name: 'Moore Admin' });
    const created = admin.isNew;
    admin.role = 'admin';
    if (created) admin.password = adminPassword;
    await admin.save();
    say(`admin account: ${adminEmail}${created ? '' : ' (existing password kept)'}`);
  }

  if (!env.isProduction) {
    const demoEmail = 'customer@example.com';
    if (!(await User.exists({ email: demoEmail }))) {
      await User.create({
        name: 'Ama Mensah',
        email: demoEmail,
        password: 'Customer123',
        phone: '(555) 201-3344',
        addresses: [
          { label: 'Home', firstName: 'Ama', lastName: 'Mensah', phone: '(555) 201-3344', street: '42 Palm Grove Ave', city: 'Atlanta', state: 'GA', zip: '30310', country: 'United States', isDefault: true },
        ],
      });
      say(`demo customer: ${demoEmail} / Customer123`);
    }
  }
}

module.exports = { seedDatabase };

// Allow `npm run seed` to run this file directly.
if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  (async () => {
    if (!env.mongoUri) {
      console.error('Set MONGODB_URI in .env before seeding (the in-memory dev database seeds itself automatically).');
      process.exit(1);
    }
    await connectDB();
    await seedDatabase({ log: true });
    await disconnectDB();
    console.log('[seed] Done.');
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
