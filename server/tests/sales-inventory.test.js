const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, signedWebhook, loginAs, request } = require('./helpers');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Promotion = require('../models/Promotion');
const InventoryLog = require('../models/InventoryLog');
const { resolvePeriod, startOfLocalDay, localDate, addDays } = require('../utils/dates');

let app;
let stripeMock;
let admin;

before(async () => {
  await setupTestDb();
  app = createApp();
  stripeMock = installStripeMock();
  admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
});
after(teardownTestDb);

const customer = {
  firstName: 'Ama',
  lastName: 'Mensah',
  email: 'ama@example.com',
  phone: '555-222-3333',
  street: '5 Palm Ave',
  city: 'Houston',
  state: 'TX',
  zip: '77001',
  country: 'United States',
};

let eventCounter = 0;

/** Creates an order through the real checkout endpoint and (optionally) pays it via a signed webhook. */
async function placeOrder(slug, quantity, { pay = true, promoCode } = {}) {
  const product = await Product.findOne({ slug });
  const variant = product.variants[0];
  const res = await request(app)
    .post('/api/checkout/session')
    .send({ items: [{ productId: product.id, variantId: variant.id, quantity }], customer, deliveryMethod: 'pickup', promoCode });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
  if (pay) {
    eventCounter += 1;
    const hook = await signedWebhook(app, {
      id: `evt_sales_${eventCounter}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: res.body.sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: Math.round(order.total * 100),
          payment_intent: `pi_sales_${eventCounter}`,
          metadata: { orderId: order.id },
        },
      },
    });
    if (hook.status !== 200) throw new Error('webhook failed');
  }
  return { order: await Order.findById(order.id), product, variant };
}

describe('Store-timezone date helpers', () => {
  test('local midnight is converted to the right UTC instant, across DST', () => {
    expect(startOfLocalDay('2026-01-15', 'America/New_York').toISOString()).toBe('2026-01-15T05:00:00.000Z');
    expect(startOfLocalDay('2026-07-15', 'America/New_York').toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(startOfLocalDay('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(localDate(new Date('2026-07-15T03:30:00Z'), 'America/New_York')).toBe('2026-07-14');
  });

  test('presets and custom periods resolve to inclusive local days', () => {
    const now = new Date('2026-11-07T15:00:00Z');
    const p = resolvePeriod({ range: '7d' }, 'America/New_York', now);
    expect(p.from).toBe('2026-11-01');
    expect(p.to).toBe('2026-11-07');
    expect(p.days).toBe(7);
    const custom = resolvePeriod({ from: '2026-10-01', to: '2026-12-31' }, 'America/New_York', now);
    expect(custom.to).toBe('2026-11-07'); // never in the future
    expect(resolvePeriod({ from: 'nonsense', to: '2026-10-01' }, 'UTC', now).days).toBe(30);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('Sales report', () => {
  test('requires an admin', async () => {
    expect((await request(app).get('/api/admin/sales')).status).toBe(401);
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await cust.get('/api/admin/sales')).status).toBe(403);
    expect((await cust.post('/api/admin/inventory/adjust').send({})).status).toBe(403);
    expect((await cust.delete('/api/admin/orders/000000000000000000000000')).status).toBe(403);
  });

  test('totals, series, top products and splits count only paid orders', async () => {
    const a = await placeOrder('grace-ackee-in-brine', 2);
    const b = await placeOrder('ting-grapefruit-soda', 3);
    await placeOrder('ting-grapefruit-soda', 1, { pay: false }); // unpaid — not a sale

    const res = await admin.get('/api/admin/sales').query({ range: '30d' });
    expect(res.status).toBe(200);
    const { summary, series, topProducts, byCategory, byFulfilment, period } = res.body;
    expect(period.days).toBe(30);
    expect(period.bucket).toBe('day');
    expect(series).toHaveLength(30);
    expect(summary.orders).toBe(2);
    expect(summary.itemsSold).toBe(5);
    expect(summary.grossSales).toBe(Math.round((a.order.total + b.order.total) * 100) / 100);
    expect(summary.averageOrder).toBe(Math.round(((a.order.total + b.order.total) / 2) * 100) / 100);
    expect(series.at(-1).orders).toBe(2);
    expect(series.reduce((s, d) => s + d.revenue, 0).toFixed(2)).toBe(summary.grossSales.toFixed(2));
    expect(topProducts.map((p) => p.name)).toContain('Grace Ackee in Brine');
    expect(byCategory.length).toBeGreaterThan(0);
    expect(byFulfilment.find((f) => f.method === 'pickup').orders).toBe(2);
    expect(res.body.previous.orders).toBe(0);

    const year = await admin.get('/api/admin/sales').query({ range: '12m' });
    expect(year.body.period.bucket).toBe('month');
    expect(year.body.summary.orders).toBe(2);
  });

  test('orders list filters by date window', async () => {
    const today = localDate(new Date(), 'America/New_York');
    const inRange = await admin.get('/api/admin/orders').query({ paymentStatus: 'paid', from: today, to: today });
    expect(inRange.body.orders.length).toBe(2);
    const old = await admin.get('/api/admin/orders').query({ from: '2020-01-01', to: '2020-01-31' });
    expect(old.body.orders).toHaveLength(0);
  });
});

describe('Deleting sales', () => {
  test('deleting a paid sale returns its stock, logs it and drops it from the report', async () => {
    const { order, product, variant } = await placeOrder('walkerswood-traditional-jerk-seasoning', 4, { promoCode: 'WELCOME10' });
    const afterSale = (await Product.findById(product.id)).variants.id(variant.id).stock;
    expect(afterSale).toBe(variant.stock - 4);
    const usedBefore = (await Promotion.findOne({ code: 'WELCOME10' })).timesUsed;
    const before = (await admin.get('/api/admin/sales')).body.summary.orders;

    const del = await admin.delete(`/api/admin/orders/${order.id}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toEqual([order.orderNumber]);
    expect(del.body.unitsReturned).toBe(4);
    expect(await Order.exists({ _id: order.id })).toBeNull();
    expect((await Product.findById(product.id)).variants.id(variant.id).stock).toBe(variant.stock);
    expect((await Promotion.findOne({ code: 'WELCOME10' })).timesUsed).toBe(usedBefore - 1);
    const log = await InventoryLog.findOne({ orderNumber: order.orderNumber, reason: 'order_deleted' });
    expect(log.change).toBe(4);
    expect(log.userName).toBe('Moore Admin');
    expect((await admin.get('/api/admin/sales')).body.summary.orders).toBe(before - 1);
  });

  test('restock=0 deletes without returning stock', async () => {
    const { order, product, variant } = await placeOrder('walkerswood-traditional-jerk-seasoning', 1);
    const del = await admin.delete(`/api/admin/orders/${order.id}`).query({ restock: '0' });
    expect(del.body.unitsReturned).toBe(0);
    expect((await Product.findById(product.id)).variants.id(variant.id).stock).toBe(variant.stock - 1);
  });

  test('deleting an unpaid order closes its open Stripe checkout first', async () => {
    const { order } = await placeOrder('ting-grapefruit-soda', 1, { pay: false });
    const expiresBefore = stripeMock.checkout.sessions.expire.calls.length;
    const del = await admin.delete(`/api/admin/orders/${order.id}`);
    expect(del.status).toBe(200);
    expect(stripeMock.checkout.sessions.expire.calls.length).toBe(expiresBefore + 1);
    expect(stripeMock._sessions.get(order.stripeSessionId).status).toBe('expired');
  });

  test('refuses to delete an "unpaid" order whose Stripe checkout has just completed', async () => {
    const { order } = await placeOrder('ting-grapefruit-soda', 1, { pay: false });
    stripeMock._sessions.get(order.stripeSessionId).status = 'complete';
    const del = await admin.delete(`/api/admin/orders/${order.id}`);
    expect(del.status).toBe(409);
    expect(await Order.exists({ _id: order.id })).not.toBeNull();
  });

  test('bulk delete removes several sales and validates input', async () => {
    const one = await placeOrder('grace-ackee-in-brine', 1);
    const two = await placeOrder('grace-ackee-in-brine', 1);
    expect((await admin.post('/api/admin/orders/delete').send({ ids: [] })).status).toBe(422);
    const res = await admin.post('/api/admin/orders/delete').send({ ids: [one.order.id, two.order.id, 'not-an-id'], restock: true });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toHaveLength(2);
    expect(res.body.unitsReturned).toBe(2);
    expect(res.body.failed).toHaveLength(0);
  });
});

describe('Inventory', () => {
  test('lists every size with status, 30-day sales and days of cover', async () => {
    const res = await admin.get('/api/admin/inventory');
    expect(res.status).toBe(200);
    const total = (await Product.find()).reduce((n, p) => n + p.variants.length, 0);
    expect(res.body.rows).toHaveLength(total);
    expect(res.body.summary.skus).toBe(total);
    const ackee = res.body.rows.find((r) => r.name === 'Grace Ackee in Brine');
    expect(ackee.sold30).toBeGreaterThan(0);
    expect(typeof ackee.daysOfCover).toBe('number');
    const out = res.body.rows.find((r) => r.stock === 0);
    expect(out.status).toBe('out');
    expect(res.body.summary.out).toBeGreaterThan(0);
  });

  test('add, remove and set stock are atomic, validated and logged', async () => {
    const product = await Product.findOne({ slug: 'grace-ackee-in-brine' });
    const v = product.variants[0];
    const base = v.stock;
    const body = { productId: product.id, variantId: v.id };

    const add = await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'add', quantity: 24, reason: 'restock', note: 'Weekly delivery' });
    expect(add.status).toBe(200);
    expect(add.body.stock).toBe(base + 24);

    const remove = await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'remove', quantity: 2, reason: 'damaged' });
    expect(remove.body.stock).toBe(base + 22);

    const tooMany = await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'remove', quantity: 100000 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.message).toMatch(/Only \d+ in stock/);

    const set = await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'set', quantity: 0 });
    expect(set.body.stock).toBe(0);
    expect(set.body.status).toBe('out');
    expect(set.body.log.change).toBe(-(base + 22));
    const after = await Product.findById(product.id);
    expect(after.totalStock).toBe(after.variants.reduce((n, x) => n + x.stock, 0));

    expect((await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'add', quantity: -5 })).status).toBe(422);
    expect((await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'add', quantity: 1.5 })).status).toBe(422);
    expect((await admin.post('/api/admin/inventory/adjust').send({ ...body, mode: 'explode', quantity: 1 })).status).toBe(422);

    const hist = await admin.get('/api/admin/inventory/history').query({ productId: product.id, variantId: v.id });
    const reasons = hist.body.logs.map((l) => l.reason);
    expect(reasons.slice(0, 3)).toEqual(['adjustment', 'damaged', 'restock']);
    expect(reasons).toContain('sale');
    expect(hist.body.logs[2].note).toBe('Weekly delivery');
    expect(hist.body.logs[2].userName).toBe('Moore Admin');
  });

  test('quick edits and product-form edits are recorded in the history', async () => {
    const product = await Product.findOne({ slug: 'ting-grapefruit-soda' });
    const v = product.variants[0];
    const quick = await admin.patch(`/api/admin/products/${product.id}/inventory`).send({ variantId: v.id, stock: v.stock + 5, price: v.price });
    expect(quick.status).toBe(200);
    const log = await InventoryLog.findOne({ variantId: v._id, reason: 'adjustment' }).sort({ createdAt: -1 });
    expect(log.change).toBe(5);

    const full = (await admin.get(`/api/admin/products/${product.id}`)).body.product;
    full.category = full.category._id || full.category.id;
    full.variants[0].stock = 7;
    const save = await admin.put(`/api/admin/products/${product.id}`).send(full);
    expect(save.status).toBe(200);
    const formLog = await InventoryLog.findOne({ variantId: v._id, note: 'Edited on the product form' });
    expect(formLog.stockAfter).toBe(7);
  });
});
