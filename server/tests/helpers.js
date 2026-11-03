// Shared test bootstrap: isolated in-memory MongoDB + seeded catalogue + mocked Stripe API.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_dummy_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CLIENT_URL = 'http://localhost:5173';

const mongoose = require('mongoose');
const Stripe = require('stripe');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../app');
const { seedDatabase } = require('../data/seed');
const { setStripeClient } = require('../config/stripe');

let mongo;

async function setupTestDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('moore-test'));
  await seedDatabase();
}

async function teardownTestDb() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

/**
 * Stripe mock: real webhook signature verification (stripe.webhooks is the genuine
 * SDK implementation), with network calls (sessions/coupons) replaced by recording spies.
 */
function spy(impl) {
  const fn = async (...args) => {
    fn.calls.push(args);
    return impl(...args);
  };
  fn.calls = [];
  return fn;
}

function installStripeMock() {
  const real = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sessions = new Map();
  let counter = 0;
  const mock = {
    webhooks: real.webhooks,
    coupons: { create: spy(async (params) => ({ id: `coupon_${++counter}`, ...params })) },
    checkout: {
      sessions: {
        create: spy(async (params) => {
          const id = `cs_test_${'a'.repeat(20)}${++counter}`;
          const session = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', payment_status: 'unpaid', ...params };
          sessions.set(id, session);
          return session;
        }),
        retrieve: spy(async (id) => sessions.get(id)),
        expire: spy(async (id) => {
          const s = sessions.get(id);
          s.status = 'expired';
          return s;
        }),
      },
    },
    _sessions: sessions,
  };
  setStripeClient(mock);
  return mock;
}

function signedWebhook(app, event) {
  const payload = JSON.stringify(event);
  const header = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return request(app).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload);
}

async function loginAs(app, email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

module.exports = { createApp, setupTestDb, teardownTestDb, installStripeMock, signedWebhook, loginAs, request };
