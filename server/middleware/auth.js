const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, ADMIN_COOKIE_NAME, verifyToken } = require('../services/tokenService');

/**
 * Two independent sessions can live in one browser:
 *  - the shop session (cookie `ms_token`) — a customer, or an admin who used the normal sign-in;
 *  - the admin session (cookie `ms_admin`) — set by the admin sign-in form on /admin.
 * Signing out of one never signs you out of the other.
 */

function readSiteToken(req) {
  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function userFromToken(token) {
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

/** The shop session's user (customer, or an admin who signed in on the normal page). */
const resolveUser = (req) => userFromToken(readSiteToken(req));

/** The admin session's user: the admin cookie, else a shop session that belongs to an admin. */
async function resolveAdmin(req) {
  const fromAdminCookie = await userFromToken(req.cookies && req.cookies[ADMIN_COOKIE_NAME]);
  if (fromAdminCookie && fromAdminCookie.role === 'admin') return fromAdminCookie;
  const site = await resolveUser(req);
  return site && site.role === 'admin' ? site : null;
}

/** Requires a logged-in shop user. */
async function protect(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) return next(new AppError('Please log in to continue.', 401));
  req.user = user;
  next();
}

/** Attaches req.user when a valid shop session exists, but never blocks. */
async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

/** Admin routes: uses the admin session, independent of whoever is signed in to the shop. */
async function protectAdmin(req, _res, next) {
  const admin = await resolveAdmin(req);
  if (admin) {
    req.user = admin;
    return next();
  }
  const site = await resolveUser(req);
  return next(site ? new AppError('Administrator access required.', 403) : new AppError('Please log in to continue.', 401));
}

/** Must be used after protect. */
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new AppError('Administrator access required.', 403));
  next();
}

module.exports = { protect, optionalAuth, protectAdmin, requireAdmin, resolveUser, resolveAdmin };
