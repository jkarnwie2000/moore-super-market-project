const User = require('../models/User');
const AppError = require('../utils/AppError');
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

function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out.' });
}

function me(req, res) {
  res.json({ user: req.user ? req.user.toSafeJSON() : null });
}

module.exports = { register, login, logout, me, validatePassword };
