// Tiny Jest-style `expect` built on node:assert, so tests read naturally under `node --test`.
const assert = require('node:assert/strict');

const ARRAY_CONTAINING = Symbol('arrayContaining');

function matchers(actual, negate = false) {
  const check = (pass, message) => {
    if (negate ? pass : !pass) assert.fail(negate ? `Expected NOT: ${message}` : message);
  };
  const show = (v) => JSON.stringify(v);
  return {
    toBe: (exp) => check(Object.is(actual, exp), `${show(actual)} to be ${show(exp)}`),
    toEqual: (exp) => {
      if (exp && exp[ARRAY_CONTAINING]) {
        return check(Array.isArray(actual) && exp.items.every((i) => actual.some((a) => isDeepEqual(a, i))), `${show(actual)} to contain ${show(exp.items)}`);
      }
      check(isDeepEqual(actual, exp), `${show(actual)} to equal ${show(exp)}`);
    },
    toBeGreaterThan: (n) => check(actual > n, `${actual} > ${n}`),
    toHaveLength: (n) => check(actual != null && actual.length === n, `length ${actual && actual.length} to be ${n}`),
    toMatch: (re) => check(typeof actual === 'string' && re.test(actual), `${show(actual)} to match ${re}`),
    toContain: (item) => check(actual != null && actual.includes(item), `${show(actual)} to contain ${show(item)}`),
    toHaveProperty: (key) => check(actual != null && Object.prototype.hasOwnProperty.call(actual, key), `object to have property ${key}`),
    toBeNull: () => check(actual === null, `${show(actual)} to be null`),
  };
}

function isDeepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

function expect(actual) {
  const m = matchers(actual);
  m.not = matchers(actual, true);
  return m;
}
expect.arrayContaining = (items) => ({ [ARRAY_CONTAINING]: true, items });

module.exports = { expect };
