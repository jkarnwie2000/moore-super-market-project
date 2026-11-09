const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, verifyToken } = require('../services/tokenService');

function readToken(req) {
  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function resolveUser(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    // Re-load the user so role changes and deletions take effect immediately.
    const user = await User.findById(payload.sub);
    // A session from before the latest password change (e.g. a reset) is no longer valid.
    if (user && (payload.v || 0) !== (user.sessionVersion || 0)) return null;
    return user;
  } catch {
    return null;
  }
}

/** Requires a logged-in user. */
async function protect(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) return next(new AppError('Please log in to continue.', 401));
  req.user = user;
  next();
}

/** Attaches req.user when a valid session exists, but never blocks. */
async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

/** Must be used after protect. */
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new AppError('Administrator access required.', 403));
  next();
}

module.exports = { protect, optionalAuth, requireAdmin };
