const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, signedWebhook, loginAs, request } = require('./helpers');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ProcessedEvent = require('../models/ProcessedEvent');

let app;
let stripeMock;

before(async () => {
  await setupTestDb();
  app = createApp();
  stripeMock = installStripeMock();
});
after(teardownTestDb);

const customer = {
  firstName: 'Kofi',
  lastName: 'Boateng',
  email: 'kofi@example.com',
  phone: '555-123-4567',
  street: '10 Market St',
  city: 'Atlanta',
  state: 'GA',
  zip: '30310',
  country: 'United States',
};

async function productBySlug(slug) {
  return Product.findOne({ slug });
}

describe('Catalogue', () => {
  test('lists products and searches by name', async () => {
    const res = await request(app).get('/api/products').query({ q: 'ackee' });
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.products.every((p) => /ackee/i.test(p.name + p.tags.join(' ') + p.brand))).toBe(true);
  });

  test('filters by category and price range, sorts by price', async () => {
    const res = await request(app).get('/api/products').query({ category: 'rice-and-grains', sort: 'price_asc', maxPrice: 10 });
    expect(res.status).toBe(200);
    const prices = res.body.products.map((p) => p.price);
    expect(prices.length).toBeGreaterThan(0);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices.every((p) => p <= 10)).toBe(true);
    expect(res.body.products.every((p) => p.category.slug === 'rice-and-grains')).toBe(true);

    const desc = await request(app).get('/api/products').query({ region: 'caribbean', sort: 'price_desc' });
    const d = desc.body.products.map((p) => p.price);
    expect(d).toEqual([...d].sort((a, b) => b - a));
    expect(desc.body.products.every((p) => p.region === 'caribbean')).toBe(true);
  });

  test('deals and featured filters', async () => {
    const deals = await request(app).get('/api/products').query({ deals: '1' });
    expect(deals.body.products.length).toBeGreaterThan(0);
    expect(deals.body.products.every((p) => p.onSale)).toBe(true);
    const featured = await request(app).get('/api/products').query({ featured: '1' });
    expect(featured.body.products.every((p) => p.featured)).toBe(true);
  });

  test('regex characters in search are escaped', async () => {
    const res = await request(app).get('/api/products').query({ q: '.*(' });
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  test('product detail returns related products; unknown slug 404s', async () => {
    const res = await request(app).get('/api/products/grace-ackee-in-brine');
    expect(res.status).toBe(200);
    expect(res.body.product.variants.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.related)).toBe(true);
    expect((await request(app).get('/api/products/does-not-exist')).status).toBe(404);
  });

  test('lists categories with counts across both regions', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.body.categories).toHaveLength(20);
    expect(res.body.categories.filter((c) => c.region === 'african')).toHaveLength(10);
  });
});

describe('Authentication & authorisation', () => {
  test('register → me → logout', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({ name: 'Test User', email: 'test@example.com', password: 'Password1', role: 'admin' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('customer'); // role in body is ignored
    expect(reg.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('test@example.com');
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  test('rejects weak passwords, duplicate emails and bad logins', async () => {
    expect((await request(app).post('/api/auth/register').send({ name: 'A B', email: 'x@example.com', password: 'short' })).status).toBe(422);
    expect((await request(app).post('/api/auth/register').send({ name: 'A B', email: 'test@example.com', password: 'Password1' })).status).toBe(409);
    expect((await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong' })).status).toBe(401);
  });

  test('blocks NoSQL operator injection on login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(401);
  });

  test('admin routes require an admin', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await cust.get('/api/admin/stats')).status).toBe(403);
    const admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
    expect((await admin.get('/api/admin/stats')).status).toBe(200);
  });

  test('customer can manage saved addresses', async () => {
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    const add = await cust.post('/api/account/addresses').send({ ...customer, label: 'Work', isDefault: true });
    expect(add.status).toBe(201);
    const work = add.body.user.addresses.find((a) => a.label === 'Work');
    expect(work.isDefault).toBe(true);
    expect(add.body.user.addresses.filter((a) => a.isDefault)).toHaveLength(1);
    const del = await cust.delete(`/api/account/addresses/${work._id}`);
    expect(del.status).toBe(200);
    expect(del.body.user.addresses.some((a) => a.isDefault)).toBe(true);
  });
});

describe('Admin product management', () => {
  let admin;
  let categoryId;
  before(async () => {
    admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
    categoryId = (await request(app).get('/api/categories')).body.categories[0].id;
  });

  test('create, update inventory, edit and delete a product', async () => {
    const create = await admin.post('/api/admin/products').send({
      name: 'Test Agbalumo',
      brand: 'Moore Fresh',
      description: 'African star apple, seasonal favourite.',
      category: categoryId,
      variants: [{ label: '1 lb', price: 5.5, stock: 10 }],
    });
    expect(create.status).toBe(201);
    const p = create.body.product;
    expect(p.slug).toBe('test-agbalumo');
    expect(p.totalStock).toBe(10);

    const inv = await admin.patch(`/api/admin/products/${p.id}/inventory`).send({ variantId: p.variants[0]._id, stock: 3, price: 4.25 });
    expect(inv.body.product.totalStock).toBe(3);
    expect(inv.body.product.price).toBe(4.25);

    const edit = await admin.put(`/api/admin/products/${p.id}`).send({
      ...p,
      category: categoryId,
      variants: [{ ...inv.body.product.variants[0], compareAtPrice: 6 }],
    });
    expect(edit.status).toBe(200);
    expect(edit.body.product.onSale).toBe(true);
    expect(edit.body.product.variants[0]._id).toBe(p.variants[0]._id); // variant id preserved

    expect((await admin.delete(`/api/admin/products/${p.id}`)).status).toBe(200);
    expect((await request(app).get('/api/products/test-agbalumo')).status).toBe(404);
  });

  test('validation errors are returned per field', async () => {
    const res = await admin.post('/api/admin/products').send({ name: '', variants: [] });
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('name');
    expect(res.body.errors).toHaveProperty('variants');
  });

  test('cannot delete a category that has products', async () => {
    expect((await admin.delete(`/api/admin/categories/${categoryId}`)).status).toBe(409);
  });
});

describe('Checkout & Stripe', () => {
  test('quote applies a promo code server-side', async () => {
    const product = await productBySlug('royal-stallion-parboiled-long-grain-rice');
    const v = product.variants[1]; // 25 lb @ 32.99
    const res = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId: product.id, variantId: v.id, quantity: 2 }], deliveryMethod: 'delivery', promoCode: 'welcome10' });
    expect(res.status).toBe(200);
    expect(res.body.totals.subtotal).toBe(65.98);
    expect(res.body.totals.discount).toBe(6.6);
    expect(res.body.totals.deliveryFee).toBe(7.99);
    const bad = await request(app).post('/api/checkout/quote').send({ items: [{ productId: product.id, variantId: v.id, quantity: 1 }], promoCode: 'NOPE' });
    expect(bad.status).toBe(422);
  });

  test('validates required checkout fields', async () => {
    const res = await request(app).post('/api/checkout/session').send({ items: [], customer: {}, deliveryMethod: 'delivery' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['firstName', 'email', 'street', 'zip']));
  });

  test('rejects quantities above available stock', async () => {
    const product = await productBySlug('elubo-yam-flour-for-amala'); // stock 3
    const res = await request(app)
      .post('/api/checkout/session')
      .send({ items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 4 }], customer, deliveryMethod: 'delivery' });
    expect(res.status).toBe(409);
    expect(res.body.errors.items[0].available).toBe(3);
  });

  test('full flow: session uses DB prices, webhook marks paid once, inventory decremented', async () => {
    const product = await productBySlug('grace-ackee-in-brine');
    const variant = product.variants[0];
    const stockBefore = variant.stock;
    const soldBefore = product.sold;

    const res = await request(app)
      .post('/api/checkout/session')
      .send({
        items: [{ productId: product.id, variantId: variant.id, quantity: 2, price: 0.01 }], // tampered price ignored
        customer,
        deliveryMethod: 'delivery',
        promoCode: 'WELCOME10',
        total: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.com/);

    const params = stripeMock.checkout.sessions.create.calls.at(-1)[0];
    expect(params.line_items[0].price_data.unit_amount).toBe(1299);
    expect(params.line_items[0].quantity).toBe(2);
    expect(params.success_url).toContain('/order-confirmation?session_id={CHECKOUT_SESSION_ID}');
    expect(params.cancel_url).toContain('/checkout?canceled=1');
    expect(params.discounts[0].coupon).toMatch(/^coupon_/);

    const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
    expect(order.paymentStatus).toBe('unpaid');
    // 25.98 - 2.60 = 23.38; tax 1.64; delivery 7.99 → 33.01
    expect(order.total).toBe(33.01);

    // Before payment the confirmation endpoint reports unpaid.
    const pending = await request(app).get(`/api/checkout/session/${res.body.sessionId}`);
    expect(pending.body.order.paymentStatus).toBe('unpaid');

    const event = {
      id: 'evt_test_paid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: res.body.sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 3301,
          payment_intent: 'pi_test_123',
          metadata: { orderId: order.id },
        },
      },
    };

    const hook = await signedWebhook(app, event);
    expect(hook.status).toBe(200);

    const paid = await Order.findById(order.id);
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.status).toBe('processing');
    expect(paid.inventoryAdjusted).toBe(true);
    expect(paid.needsReview).toBe(false);

    const after = await Product.findById(product.id);
    expect(after.variants[0].stock).toBe(stockBefore - 2);
    expect(after.sold).toBe(soldBefore + 2);

    // Retried delivery of the same event is ignored.
    const dup = await signedWebhook(app, event);
    expect(dup.body.duplicate).toBe(true);
    // A different event for the same session also does not double-decrement.
    await signedWebhook(app, { ...event, id: 'evt_test_paid_2' });
    expect((await Product.findById(product.id)).variants[0].stock).toBe(stockBefore - 2);
    expect(await ProcessedEvent.countDocuments()).toBe(2);

    const confirm = await request(app).get(`/api/checkout/session/${res.body.sessionId}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.paymentStatus).toBe('paid');
    expect(confirm.body.order.orderNumber).toMatch(/^MS-\d{6}-[A-F0-9]{6}$/);
    expect(confirm.body.order).not.toHaveProperty('stripeSessionId');
  });

  test('confirmation page reconciles with Stripe if the webhook is late', async () => {
    const product = await productBySlug('ting-grapefruit-soda');
    const res = await request(app)
      .post('/api/checkout/session')
      .send({ items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }], customer, deliveryMethod: 'pickup' });
    expect(res.status).toBe(201);
    const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
    const s = stripeMock._sessions.get(res.body.sessionId);
    s.payment_status = 'paid';
    s.status = 'complete';
    s.amount_total = Math.round(order.total * 100);
    s.payment_intent = 'pi_late';
    const confirm = await request(app).get(`/api/checkout/session/${res.body.sessionId}`);
    expect(confirm.body.order.paymentStatus).toBe('paid');
  });

  test('rejects webhooks with an invalid signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=deadbeef')
      .send(JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed', data: { object: {} } }));
    expect(res.status).toBe(400);
  });

  test('canceled and expired sessions mark the order, never a paid one', async () => {
    const product = await productBySlug('coconut-milk-full-fat');
    const mk = () =>
      request(app)
        .post('/api/checkout/session')
        .send({ items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }], customer, deliveryMethod: 'pickup' });

    const a = await mk();
    const cancel = await request(app).post('/api/checkout/cancel').send({ sessionId: a.body.sessionId });
    expect(cancel.body.canceled).toBe(true);
    expect((await Order.findOne({ stripeSessionId: a.body.sessionId })).paymentStatus).toBe('canceled');

    const b = await mk();
    const order = await Order.findOne({ stripeSessionId: b.body.sessionId });
    await signedWebhook(app, { id: 'evt_exp_1', type: 'checkout.session.expired', data: { object: { id: b.body.sessionId, metadata: { orderId: order.id } } } });
    const expired = await Order.findById(order.id);
    expect(expired.paymentStatus).toBe('expired');
    expect(expired.status).toBe('canceled');
  });

  test('customer sees their paid orders in their account', async () => {
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    const product = await productBySlug('green-plantains');
    const res = await cust
      .post('/api/checkout/session')
      .send({ items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 3 }], customer, deliveryMethod: 'pickup' });
    const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
    expect(order.user).not.toBeNull();
    await signedWebhook(app, {
      id: 'evt_cust_paid',
      type: 'checkout.session.completed',
      data: { object: { id: res.body.sessionId, payment_status: 'paid', amount_total: Math.round(order.total * 100), metadata: { orderId: order.id } } },
    });
    const mine = await cust.get('/api/account/orders');
    expect(mine.body.orders.map((o) => o.orderNumber)).toContain(order.orderNumber);

    const admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
    const upd = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'ready_for_pickup' });
    expect(upd.body.order.status).toBe('ready_for_pickup');
  });
});
