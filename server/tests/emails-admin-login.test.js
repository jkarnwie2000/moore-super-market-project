const { describe, test, before, after, beforeEach } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, signedWebhook, loginAs, request } = require('./helpers');
const Product = require('../models/Product');
const Order = require('../models/Order');
const env = require('../config/env');
const { setEmailTransport } = require('../services/emailService');

let app;
let outbox = [];
let failNext = false;
let n = 0;

before(async () => {
  await setupTestDb();
  app = createApp();
  installStripeMock();
  env.storeNotifyEmail = 'orders@moore-shop.example';
  setEmailTransport(async (msg) => {
    if (failNext) {
      failNext = false;
      throw new Error('SMTP down');
    }
    outbox.push(msg);
    return { sent: true };
  });
});
after(async () => {
  setEmailTransport(null);
  env.storeNotifyEmail = '';
  await teardownTestDb();
});
beforeEach(() => {
  outbox = [];
});

const customer = { firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.com', phone: '555-222-3333', street: '5 Palm Ave', city: 'Houston', state: 'TX', zip: '77001', country: 'United States' };

async function payOrder() {
  const p = await Product.findOne({ slug: 'grace-ackee-in-brine' });
  const res = await request(app)
    .post('/api/checkout/session')
    .send({ items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 2 }], customer, deliveryMethod: 'delivery' });
  const order = await Order.findOne({ stripeSessionId: res.body.sessionId });
  n += 1;
  const event = {
    id: `evt_mail_${n}`,
    type: 'checkout.session.completed',
    data: { object: { id: res.body.sessionId, object: 'checkout.session', payment_status: 'paid', amount_total: Math.round(order.total * 100), payment_intent: `pi_mail_${n}`, metadata: { orderId: order.id } } },
  };
  const hook = await signedWebhook(app, event);
  return { order, event, hook };
}

describe('Purchase emails', () => {
  test('a paid order emails the shopper a confirmation and the business an alert', async () => {
    const { order, hook } = await payOrder();
    expect(hook.status).toBe(200);
    expect(outbox).toHaveLength(2);
    const [toCustomer, toStore] = outbox;
    expect(toCustomer.to).toBe('ama@example.com');
    expect(toCustomer.subject).toBe(`Order confirmed — ${order.orderNumber}`);
    expect(toCustomer.text).toContain('Grace Ackee in Brine');
    expect(toCustomer.text).toContain(`Total paid: $${order.total.toFixed(2)}`);
    expect(toCustomer.text).toContain('Home delivery: 5 Palm Ave');
    expect(toCustomer.replyTo).toBe('orders@moore-shop.example');
    expect(toStore.to).toBe('orders@moore-shop.example');
    expect(toStore.subject).toContain(`New order ${order.orderNumber}`);
    expect(toStore.text).toContain('ama@example.com');
    expect(toStore.text).toContain(`/admin/orders?open=${order.id}`);
    expect(toStore.replyTo).toBe('ama@example.com');
    const saved = await Order.findById(order.id);
    expect(saved.emailStatus).toBe('customer:sent store:sent');
  });

  test('Stripe retries and the confirmation-page fallback never send twice', async () => {
    const { order, event } = await payOrder();
    expect(outbox).toHaveLength(2);
    await signedWebhook(app, { ...event, id: `${event.id}_retry` });
    await request(app).get(`/api/checkout/session/${order.stripeSessionId}`);
    expect(outbox).toHaveLength(2);
  });

  test('an email failure never breaks the payment', async () => {
    failNext = true;
    const { order, hook } = await payOrder();
    expect(hook.status).toBe(200);
    const saved = await Order.findById(order.id);
    expect(saved.paymentStatus).toBe('paid');
    expect(saved.emailStatus).toBe('customer:failed store:sent');
  });

  test('admins can see the email set-up and send a test', async () => {
    const admin = await loginAs(app, 'admin@mooresupermarket.com', 'MooreAdmin123');
    const s = await admin.get('/api/admin/email');
    expect(s.body.enabled).toBe(true);
    expect(s.body.notifyTo).toBe('orders@moore-shop.example');
    const t = await admin.post('/api/admin/email/test');
    expect(t.status).toBe(200);
    expect(outbox[0].to).toBe('orders@moore-shop.example');
    const cust = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await cust.post('/api/admin/email/test')).status).toBe(403);
  });
});

describe('Admin sign-in while a customer is signed in', () => {
  test('admin details switch the session to the admin account', async () => {
    const agent = await loginAs(app, 'customer@example.com', 'Customer123');
    expect((await agent.get('/api/admin/stats')).status).toBe(403);
    const res = await agent.post('/api/auth/admin-login').send({ email: 'admin@mooresupermarket.com', password: 'MooreAdmin123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect((await agent.get('/api/admin/stats')).status).toBe(200);
  });

  test('customer details are refused and the customer stays signed in', async () => {
    const agent = await loginAs(app, 'customer@example.com', 'Customer123');
    const res = await agent.post('/api/auth/admin-login').send({ email: 'customer@example.com', password: 'Customer123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/doesn't have admin access/);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('customer@example.com');
    const wrong = await agent.post('/api/auth/admin-login').send({ email: 'admin@mooresupermarket.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('customer@example.com');
  });
});
