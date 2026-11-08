const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, signedWebhook, loginAs, request } = require('./helpers');
const Product = require('../models/Product');
const Order = require('../models/Order');
const InventoryLog = require('../models/InventoryLog');

let app;
let admin;
let n = 0;

before(async () => {
  await setupTestDb();
  app = createApp();
  installStripeMock();
  admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
});
after(teardownTestDb);

const customer = { firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.com', phone: '555-222-3333' };

/** A paid order with `qtyA` of ackee and `qtyB` of Ting, paid through a signed webhook. */
async function paidOrder(qtyA = 3, qtyB = 2) {
  const a = await Product.findOne({ slug: 'grace-ackee-in-brine' });
  const b = await Product.findOne({ slug: 'ting-grapefruit-soda' });
  const res = await request(app)
    .post('/api/checkout/session')
    .send({
      items: [
        { productId: a.id, variantId: a.variants[0].id, quantity: qtyA },
        { productId: b.id, variantId: b.variants[0].id, quantity: qtyB },
      ],
      customer,
      deliveryMethod: 'pickup',
    });
  const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
  n += 1;
  await signedWebhook(app, {
    id: `evt_ret_paid_${n}`,
    type: 'checkout.session.completed',
    data: { object: { id: res.body.sessionId, object: 'checkout.session', payment_status: 'paid', amount_total: Math.round(order.total * 100), payment_intent: `pi_ret_${n}`, metadata: { orderId: order.id } } },
  });
  return { order: await Order.findById(order.id), a, b };
}

const stockOf = async (product) => (await Product.findById(product.id)).variants[0].stock;

describe('Recording returns', () => {
  test('restocks returned items, writes off damaged ones, and logs both on the order', async () => {
    const { order, a, b } = await paidOrder(3, 2);
    const aBefore = await stockOf(a);
    const bBefore = await stockOf(b);

    const res = await admin.post(`/api/admin/orders/${order.id}/returns`).send({
      items: [
        { variantId: a.variants[0].id, quantity: 2, restock: true },
        { variantId: b.variants[0].id, quantity: 1, restock: false },
      ],
      reason: 'customer_return',
      note: 'Came back unopened',
    });
    expect(res.status).toBe(201);
    expect(res.body.unitsReturned).toBe(3);
    expect(res.body.unitsRestocked).toBe(2);
    expect(await stockOf(a)).toBe(aBefore + 2);
    expect(await stockOf(b)).toBe(bBefore); // written off, not back on the shelf

    const saved = await Order.findById(order.id);
    expect(saved.items[0].returnedQuantity).toBe(2);
    expect(saved.items[0].restockedQuantity).toBe(2);
    expect(saved.items[1].returnedQuantity).toBe(1);
    expect(saved.items[1].restockedQuantity).toBe(0);
    expect(saved.returns).toHaveLength(1);
    expect(saved.returns[0].userName).toBe('Moore Admin');
    expect(saved.returns[0].value).toBe(Math.round((a.variants[0].price * 2 + b.variants[0].price) * 100) / 100);

    const log = await InventoryLog.findOne({ orderNumber: order.orderNumber, reason: 'returned' });
    expect(log.change).toBe(2);
    expect(log.note).toMatch(/Came back unopened/);
  });

  test('cannot return more than was bought (across several returns)', async () => {
    const { order, a } = await paidOrder(2, 1);
    const ok = await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    expect(ok.status).toBe(201);
    const tooMany = await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 2 }] });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.message).toMatch(/Only 1/);
    const none = await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [] });
    expect(none.status).toBe(422);
  });

  test('unpaid orders cannot have returns; customers cannot record them', async () => {
    const a = await Product.findOne({ slug: 'grace-ackee-in-brine' });
    const res = await request(app)
      .post('/api/checkout/session')
      .send({ items: [{ productId: a.id, variantId: a.variants[0].id, quantity: 1 }], customer, deliveryMethod: 'pickup' });
    const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
    const r = await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    expect(r.status).toBe(409);
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await cust.post(`/api/admin/orders/${order.id}/returns`).send({})).status).toBe(403);
  });
});

describe('Cancelling, refunding and deleting never restock the same unit twice', () => {
  test('cancelling a paid order restocks only what has not already been returned', async () => {
    const { order, a, b } = await paidOrder(3, 2);
    await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    const aBefore = await stockOf(a);
    const bBefore = await stockOf(b);

    const cancel = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'canceled' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.unitsRestocked).toBe(4); // 2 ackee + 2 Ting
    expect(cancel.body.order.status).toBe('canceled');
    expect(await stockOf(a)).toBe(aBefore + 2);
    expect(await stockOf(b)).toBe(bBefore + 2);

    // Cancelling again does nothing; reopening is blocked; deleting returns nothing more.
    const again = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'canceled' });
    expect(again.body.unitsRestocked).toBe(0);
    expect((await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'processing' })).status).toBe(409);
    const del = await admin.delete(`/api/admin/orders/${order.id}`);
    expect(del.body.unitsReturned).toBe(0);
    expect(await stockOf(a)).toBe(aBefore + 2);
  });

  test('deleting a partly returned sale restocks only the remainder', async () => {
    const { order, a } = await paidOrder(4, 1);
    await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 3, restock: false }] });
    const before = await stockOf(a);
    const del = await admin.delete(`/api/admin/orders/${order.id}`);
    expect(del.body.unitsReturned).toBe(2); // 1 ackee + 1 Ting
    expect(await stockOf(a)).toBe(before + 1);
  });

  test('a full Stripe refund before hand-over cancels the order and restocks it, once', async () => {
    const { order, a } = await paidOrder(2, 1);
    const before = await stockOf(a);
    const event = {
      id: 'evt_refund_full_1',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', object: 'charge', payment_intent: order.stripePaymentIntentId, amount: Math.round(order.total * 100), amount_refunded: Math.round(order.total * 100), refunded: true, metadata: {} } },
    };
    expect((await signedWebhook(app, event)).status).toBe(200);
    const saved = await Order.findById(order.id);
    expect(saved.paymentStatus).toBe('refunded');
    expect(saved.status).toBe('canceled');
    expect(saved.amountRefunded).toBe(order.total);
    expect(saved.returns[0].kind).toBe('refunded');
    expect(await stockOf(a)).toBe(before + 2);
    expect(await InventoryLog.countDocuments({ orderNumber: order.orderNumber, reason: 'refunded' })).toBe(2);

    // A second, different event for the same refund changes nothing.
    await signedWebhook(app, { ...event, id: 'evt_refund_full_2' });
    expect(await stockOf(a)).toBe(before + 2);
  });

  test('a refund after the order was completed flags it instead of guessing what came back', async () => {
    const { order, a } = await paidOrder(1, 1);
    await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: 'completed' });
    const before = await stockOf(a);
    await signedWebhook(app, {
      id: 'evt_refund_done',
      type: 'charge.refunded',
      data: { object: { id: 'ch_2', object: 'charge', payment_intent: order.stripePaymentIntentId, amount: 1000, amount_refunded: 1000, refunded: true } },
    });
    const saved = await Order.findById(order.id);
    expect(saved.paymentStatus).toBe('refunded');
    expect(saved.status).toBe('completed');
    expect(saved.needsReview).toBe(true);
    expect(saved.reviewReason).toMatch(/Record a return/);
    expect(await stockOf(a)).toBe(before);

    // Staff then record what actually came back.
    const r = await admin.post(`/api/admin/orders/${order.id}/returns`).send({ items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    expect(r.status).toBe(201);
    expect(await stockOf(a)).toBe(before + 1);
  });

  test('a partial refund records the amount and flags the order, without touching stock', async () => {
    const { order, a } = await paidOrder(2, 1);
    const before = await stockOf(a);
    await signedWebhook(app, {
      id: 'evt_refund_partial',
      type: 'charge.refunded',
      data: { object: { id: 'ch_3', object: 'charge', payment_intent: order.stripePaymentIntentId, amount: Math.round(order.total * 100), amount_refunded: 500, refunded: false } },
    });
    const saved = await Order.findById(order.id);
    expect(saved.paymentStatus).toBe('paid');
    expect(saved.amountRefunded).toBe(5);
    expect(saved.needsReview).toBe(true);
    expect(await stockOf(a)).toBe(before);
  });
});

describe('Reports reflect returns', () => {
  test('sales summary counts returned units and value; 30-day sold excludes returns', async () => {
    const res = await admin.get('/api/admin/sales').query({ range: '7d' });
    expect(res.body.summary.returnedUnits).toBeGreaterThan(0);
    expect(res.body.summary.returnsValue).toBeGreaterThan(0);
    expect(res.body.summary.refunds).toBeGreaterThan(0);
    // Cancelled orders are not sales, even while still marked paid.
    const { order: toCancel } = await paidOrder(1, 1);
    await admin.patch(`/api/admin/orders/${toCancel.id}/status`).send({ status: 'canceled' });
    const after = await admin.get('/api/admin/sales').query({ range: '7d' });
    expect(after.body.summary.orders).toBe(res.body.summary.orders);
    expect(res.body.summary.orders).toBe(await Order.countDocuments({ paymentStatus: 'paid', status: { $ne: 'canceled' } }));
    const list = await admin.get('/api/admin/orders').query({ paymentStatus: 'paid', excludeCanceled: '1' });
    expect(list.body.orders.every((o) => o.status !== 'canceled')).toBe(true);

    const orders = await Order.find({ paymentStatus: 'paid' });
    const ting = await Product.findOne({ slug: 'ting-grapefruit-soda' });
    const vid = String(ting.variants[0]._id);
    let expected = 0;
    for (const o of orders) for (const i of o.items) if (String(i.variantId) === vid) expected += i.quantity - (i.returnedQuantity || 0);
    const inv = await admin.get('/api/admin/inventory');
    expect(inv.body.rows.find((r) => r.variantId === vid).sold30).toBe(expected);
  });
});
