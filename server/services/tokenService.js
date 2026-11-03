const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COOKIE_NAME = 'ms_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const signToken = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  maxAge: MAX_AGE_MS,
  path: '/',
});

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

module.exports = { COOKIE_NAME, signToken, verifyToken, setAuthCookie, clearAuthCookie };
