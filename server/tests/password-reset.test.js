const { describe, test, before, after, beforeEach } = require('node:test');
const { expect } = require('./expect');
const { createApp, setupTestDb, teardownTestDb, installStripeMock, loginAs, request } = require('./helpers');
const User = require('../models/User');
const { setEmailTransport } = require('../services/emailService');

let app;
let outbox = [];

before(async () => {
  await setupTestDb();
  app = createApp();
  installStripeMock();
  setEmailTransport(async (msg) => {
    outbox.push(msg);
    return { sent: true };
  });
});
after(async () => {
  setEmailTransport(null);
  await teardownTestDb();
});
beforeEach(() => {
  outbox = [];
});

const ADMIN = 'admin@mooresupermarket.com';
const tokenFrom = (msg) => (msg.text.match(/token=([a-f0-9]{64})/) || [])[1];

describe('Forgot password', () => {
  test('answers the same way whether or not the email has an account', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: ADMIN });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(known.body.emailEnabled).toBe(true);
    expect(outbox).toHaveLength(1); // only the real account gets an email
    expect(outbox[0].to).toBe(ADMIN);
    expect(outbox[0].text).toContain('/reset-password?token=');
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' })).status).toBe(422);
  });

  test('only a hash of the token is stored, with a 1-hour expiry', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: ADMIN });
    const token = tokenFrom(outbox[0]);
    const user = await User.findOne({ email: ADMIN }).select('+resetPasswordTokenHash +resetPasswordExpires');
    expect(user.resetPasswordTokenHash).toHaveLength(64);
    expect(user.resetPasswordTokenHash === token).toBe(false);
    const mins = (user.resetPasswordExpires - Date.now()) / 60000;
    expect(mins > 59 && mins <= 60).toBe(true);
    // Never leaked through the API.
    const me = await (await loginAs(app, ADMIN, 'MooreAdmin123')).get('/api/auth/me');
    expect(JSON.stringify(me.body)).not.toContain('reset');
  });
});

describe('Reset password', () => {
  test('sets the new password, signs in, works once, and signs out old sessions', async () => {
    const oldSession = await loginAs(app, ADMIN, 'MooreAdmin123');
    expect((await oldSession.get('/api/admin/stats')).status).toBe(200);

    await request(app).post('/api/auth/forgot-password').send({ email: ADMIN });
    const token = tokenFrom(outbox[0]);

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(422);

    const agent = request.agent(app);
    const res = await agent.post('/api/auth/reset-password').send({ token, password: 'NewAdminPass9' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN);
    expect((await agent.get('/api/admin/stats')).status).toBe(200); // signed in with the new session

    // Old password no longer works; new one does.
    expect((await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'MooreAdmin123' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'NewAdminPass9' })).status).toBe(200);

    // The session from before the reset is signed out.
    expect((await oldSession.get('/api/admin/stats')).status).toBe(401);

    // The link can't be used twice.
    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'Another123' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/invalid or has expired/);

    // Restore the seed password for other tests.
    const u = await User.findOne({ email: ADMIN });
    u.password = 'MooreAdmin123';
    await u.save();
  });

  test('expired and made-up tokens are rejected', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'customer@example.com' });
    const token = tokenFrom(outbox[0]);
    await User.updateOne({ email: 'customer@example.com' }, { resetPasswordExpires: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Customer456' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'Customer456' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: { $ne: null }, password: 'Customer456' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: 'customer@example.com', password: 'Customer123' })).status).toBe(200);
  });
});
