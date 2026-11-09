const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { sendEmail, emailEnabled } = require('../services/emailService');
const { resolveUser, resolveAdmin } = require('../middleware/auth');
const { EMAIL_RE, str } = require('../utils/validators');
const { setAuthCookie, clearAuthCookie } = require('../services/tokenService');

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be 8–128 characters.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number.';
  return null;
}

async function register(req, res) {
  const name = str(req.body.name, 100);
  const email = str(req.body.email, 120).toLowerCase();
  const { password } = req.body;

  const errors = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  const pwError = validatePassword(password);
  if (pwError) errors.password = pwError;
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);

  if (await User.exists({ email })) {
    throw new AppError('An account with that email already exists.', 409, { email: 'Email already registered' });
  }

  // Role is never taken from the request: new accounts are always customers.
  const user = await User.create({ name, email, password, role: 'customer' });
  setAuthCookie(res, user);
  res.status(201).json({ user: user.toSafeJSON() });
}

async function login(req, res) {
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await User.findOne({ email }).select('+password') : null;
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Incorrect email or password.', 401);
  }
  setAuthCookie(res, user);
  res.json({ user: user.toSafeJSON() });
}

/**
 * POST /api/auth/admin-login — the admin sign-in shown on /admin. Only switches this
 * browser's session if the account is an administrator; a customer who is already signed
 * in stays signed in as themselves when the details aren't an admin's.
 */
async function adminLogin(req, res) {
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await User.findOne({ email }).select('+password') : null;
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Incorrect email or password.', 401);
  }
  if (user.role !== 'admin') {
    throw new AppError("That account doesn't have admin access. Use the store's admin email and password.", 403);
  }
  // Separate admin session: whoever is signed in to the shop stays signed in.
  setAuthCookie(res, user, { admin: true });
  res.json({ admin: user.toSafeJSON() });
}

/**
 * POST /api/auth/admin-logout — signs out of the admin dashboard only. A customer signed in
 * to the shop stays signed in; an admin who used the normal sign-in page is signed out too.
 */
async function adminLogout(req, res) {
  clearAuthCookie(res, { admin: true });
  const site = await resolveUser(req);
  if (site && site.role === 'admin') {
    clearAuthCookie(res);
    return res.json({ user: null });
  }
  res.json({ user: site ? site.toSafeJSON() : null });
}

function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out.' });
}

/** GET /api/auth/me — both sessions: the shop user and the admin (if any). */
async function me(req, res) {
  const admin = await resolveAdmin(req);
  res.json({ user: req.user ? req.user.toSafeJSON() : null, admin: admin ? admin.toSafeJSON() : null });
}

/* ----------------------------- Password reset ----------------------------- */

const RESET_TTL_MS = 60 * 60 * 1000; // links work for 1 hour
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * POST /api/auth/forgot-password { email }
 * Always answers the same way, so it never reveals whether an email has an account.
 */
async function forgotPassword(req, res) {
  const email = str(req.body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError('Please enter a valid email address.', 422, { email: 'Invalid email' });

  const user = await User.findOne({ email });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();

    const link = `${env.clientUrl}/reset-password?token=${token}`;
    const name = escapeHtml(user.name.split(' ')[0] || 'there');
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Moore Supermarket password',
        text: `Hi ${user.name},\n\nWe received a request to reset your Moore Supermarket password. Open this link to choose a new one (it expires in 1 hour):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.\n`,
        html: `<p>Hi ${name},</p><p>We received a request to reset your Moore Supermarket password.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1f5135;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
      });
    } catch (err) {
      console.error('[auth] Password reset email failed:', err.message);
    }
  }

  res.json({
    message: "If there's an account for that email, we've sent a link to reset the password. It expires in 1 hour.",
    emailEnabled: emailEnabled(),
  });
}

/** POST /api/auth/reset-password { token, password } — sets the new password and signs in. */
async function resetPassword(req, res) {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const invalid = new AppError('This reset link is invalid or has expired. Please request a new one.', 400);
  if (!/^[a-f0-9]{64}$/.test(token)) throw invalid;

  const pwError = validatePassword(req.body.password);
  if (pwError) throw new AppError(pwError, 422, { password: pwError });

  const user = await User.findOne({ resetPasswordTokenHash: hashToken(token), resetPasswordExpires: { $gt: new Date() } }).select(
    '+resetPasswordTokenHash +resetPasswordExpires'
  );
  if (!user) throw invalid;

  user.password = req.body.password;
  user.resetPasswordTokenHash = undefined; // single use
  user.resetPasswordExpires = undefined;
  await user.save(); // also signs out every older session (passwordChangedAt)

  setAuthCookie(res, user);
  res.json({ user: user.toSafeJSON(), message: 'Your password has been changed.' });
}

module.exports = { register, login, adminLogin, adminLogout, logout, me, validatePassword, forgotPassword, resetPassword };
