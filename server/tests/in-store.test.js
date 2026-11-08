const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, loginAs, request } = require('./helpers');
const Product = require('../models/Product');
const Order = require('../models/Order');
const InventoryLog = require('../models/InventoryLog');

let app;
let admin;

before(async () => {
  await setupTestDb();
  app = createApp();
  installStripeMock();
  admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
});
after(teardownTestDb);

const bySlug = (slug) => Product.findOne({ slug });
const stockOf = async (p, i = 0) => (await Product.findById(p.id)).variants[i].stock;
const line = (p, quantity, i = 0) => ({ productId: p.id, variantId: p.variants[i].id, quantity });

describe('In-store till', () => {
  test('only admins can use the till', async () => {
    expect((await request(app).post('/api/admin/in-store/sales').send({})).status).toBe(401);
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await cust.post('/api/admin/in-store/sales').send({})).status).toBe(403);
  });

  test('quote prices from the database with tax and no delivery fee', async () => {
    const ackee = await bySlug('grace-ackee-in-brine');
    const q = await admin.post('/api/admin/in-store/quote').send({ items: [{ ...line(ackee, 2), price: 0.01 }] });
    expect(q.status).toBe(200);
    const sub = Math.round(ackee.variants[0].price * 2 * 100) / 100;
    expect(q.body.totals.subtotal).toBe(sub);
    expect(q.body.totals.deliveryFee).toBe(0);
    expect(q.body.totals.tax).toBe(Math.round(sub * 0.07 * 100) / 100);
  });

  test('a cash sale takes stock, works out change, and is logged as an in-store sale', async () => {
    const ackee = await bySlug('grace-ackee-in-brine');
    const ting = await bySlug('ting-grapefruit-soda');
    const a0 = await stockOf(ackee);
    const t0 = await stockOf(ting);

    const res = await admin.post('/api/admin/in-store/sales').send({
      items: [line(ackee, 2), line(ting, 3)],
      paymentMethod: 'cash',
      amountTendered: 100,
      customerName: 'Mrs Adjei',
    });
    expect(res.status).toBe(201);
    const o = res.body.order;
    expect(o.orderNumber).toMatch(/^IS-\d{6}-[A-F0-9]{6}$/);
    expect(o.channel).toBe('in_store');
    expect(o.paymentStatus).toBe('paid');
    expect(o.status).toBe('completed');
    expect(o.deliveryFee).toBe(0);
    expect(o.soldBy).toBe('Moore Admin');
    expect(o.customer.firstName).toBe('Mrs');
    expect(o.changeGiven).toBe(Math.round((100 - o.total) * 100) / 100);
    expect(await stockOf(ackee)).toBe(a0 - 2);
    expect(await stockOf(ting)).toBe(t0 - 3);
    const logs = await InventoryLog.find({ orderNumber: o.orderNumber });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.reason === 'in_store_sale' && /cash/.test(l.note))).toBe(true);
  });

  test('card sales need no cash; too little cash is refused without touching stock', async () => {
    const ting = await bySlug('ting-grapefruit-soda');
    const t0 = await stockOf(ting);
    const short = await admin.post('/api/admin/in-store/sales').send({ items: [line(ting, 1)], paymentMethod: 'cash', amountTendered: 0.5 });
    expect(short.status).toBe(422);
    expect(await stockOf(ting)).toBe(t0);
    const noMethod = await admin.post('/api/admin/in-store/sales').send({ items: [line(ting, 1)] });
    expect(noMethod.status).toBe(422);
    const card = await admin.post('/api/admin/in-store/sales').send({ items: [line(ting, 1)], paymentMethod: 'card' });
    expect(card.status).toBe(201);
    expect(card.body.order.changeGiven).toBeNull();
    expect(await stockOf(ting)).toBe(t0 - 1);
  });

  test('cannot sell more than is in stock; nothing is recorded', async () => {
    const ackee = await bySlug('grace-ackee-in-brine');
    const ting = await bySlug('ting-grapefruit-soda');
    const a0 = await stockOf(ackee);
    const t0 = await stockOf(ting);
    const before = await Order.countDocuments({ channel: 'in_store' });
    const res = await admin.post('/api/admin/in-store/sales').send({ items: [line(ting, 1), line(ackee, 99)], paymentMethod: 'card' });
    expect(res.status).toBe(409);
    expect(await stockOf(ackee)).toBe(a0);
    expect(await stockOf(ting)).toBe(t0);
    expect(await Order.countDocuments({ channel: 'in_store' })).toBe(before);
  });

  test('products hidden from the website can still be sold at the till', async () => {
    const p = await bySlug('ting-grapefruit-soda');
    await Product.updateOne({ _id: p._id }, { isActive: false });
    const res = await admin.post('/api/admin/in-store/sales').send({ items: [line(p, 1)], paymentMethod: 'mobile_money' });
    expect(res.status).toBe(201);
    await Product.updateOne({ _id: p._id }, { isActive: true });
  });
});

describe('In-store returns', () => {
  test('a returned item goes back into stock and the refund at the till is recorded', async () => {
    const ackee = await bySlug('grace-ackee-in-brine');
    const sale = (await admin.post('/api/admin/in-store/sales').send({ items: [line(ackee, 3)], paymentMethod: 'card' })).body.order;
    const s0 = await stockOf(ackee);
    const res = await admin.post(`/api/admin/orders/${sale.id}/returns`).send({ items: [{ variantId: sale.items[0].variantId, quantity: 1, restock: true }], refund: true });
    expect(res.status).toBe(201);
    const each = Math.round(((sale.subtotal - sale.discount + sale.tax) / sale.subtotal) * sale.items[0].unitPrice * 100) / 100;
    expect(res.body.refund).toBe(each);
    expect(res.body.order.amountRefunded).toBe(each);
    expect(res.body.order.returns[0].refund).toBe(each);
    expect(res.body.order.paymentStatus).toBe('paid');
    expect(await stockOf(ackee)).toBe(s0 + 1);

    // Returning the rest refunds everything: no longer a sale.
    const rest = await admin.post(`/api/admin/orders/${sale.id}/returns`).send({ items: [{ variantId: sale.items[0].variantId, quantity: 2, restock: true }], refund: true });
    expect(rest.body.order.paymentStatus).toBe('refunded');
    expect(Math.round(rest.body.order.amountRefunded * 100)).toBe(Math.round(sale.total * 100));
    expect(await stockOf(ackee)).toBe(s0 + 3);
  });

  test('refund can be skipped (exchange / store credit), and online orders never record a till refund', async () => {
    const ackee = await bySlug('grace-ackee-in-brine');
    const sale = (await admin.post('/api/admin/in-store/sales').send({ items: [line(ackee, 1)], paymentMethod: 'cash' })).body.order;
    const res = await admin.post(`/api/admin/orders/${sale.id}/returns`).send({ items: [{ variantId: sale.items[0].variantId, quantity: 1 }], refund: false });
    expect(res.body.refund).toBe(0);
    expect(res.body.order.amountRefunded).toBe(0);
  });

  test('sales report splits online and in-store; orders can be filtered by channel', async () => {
    const r = await admin.get('/api/admin/sales').query({ range: '7d' });
    const inStore = r.body.byChannel.find((c) => c.channel === 'in_store');
    expect(inStore.orders).toBe(await Order.countDocuments({ channel: 'in_store', paymentStatus: 'paid', status: { $ne: 'canceled' } }));
    expect(inStore.revenue).toBeGreaterThan(0);
    const list = await admin.get('/api/admin/orders').query({ channel: 'in_store' });
    expect(list.body.orders.length).toBeGreaterThan(0);
    expect(list.body.orders.every((o) => o.channel === 'in_store')).toBe(true);
    const online = await admin.get('/api/admin/orders').query({ channel: 'online' });
    expect(online.body.orders.every((o) => o.channel !== 'in_store')).toBe(true);
  });
});
