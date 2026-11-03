/**
 * Strips keys that could be used for MongoDB operator injection ("$gt", "a.b")
 * from request bodies, recursively. Query strings are parsed field-by-field in
 * controllers and always coerced to strings, so they are not mutated here.
 */
function clean(value, depth = 0) {
  if (depth > 10) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}

module.exports = { sanitizeBody, clean };
