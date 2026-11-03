import { describe, expect, test } from 'vitest';
import { cartReducer, cartCount, lineKey } from '../utils/cartLogic';
import { estimateTotals } from '../utils/pricing';
import { validateCheckout } from '../utils/checkoutValidation';
import { rice, ackee } from './fixtures';

describe('cartReducer', () => {
  test('adds items and merges repeated adds of the same size', () => {
    let s = cartReducer([], { type: 'add', product: rice, variant: rice.variants[1], quantity: 2 });
    s = cartReducer(s, { type: 'add', product: rice, variant: rice.variants[1], quantity: 3 });
    expect(s).toHaveLength(1);
    expect(s[0].quantity).toBe(5);
    s = cartReducer(s, { type: 'add', product: rice, variant: rice.variants[0], quantity: 1 });
    expect(s).toHaveLength(2);
    expect(cartCount(s)).toBe(6);
  });

  test('never exceeds available stock', () => {
    let s = cartReducer([], { type: 'add', product: rice, variant: rice.variants[0], quantity: 10 });
    expect(s[0].quantity).toBe(3);
    s = cartReducer(s, { type: 'setQuantity', key: s[0].key, quantity: 99 });
    expect(s[0].quantity).toBe(3);
    expect(cartReducer([], { type: 'add', product: ackee, variant: { ...ackee.variants[0], stock: 0 } })).toEqual([]);
  });

  test('setting quantity to 0 or removing deletes the line', () => {
    const s = cartReducer([], { type: 'add', product: ackee, variant: ackee.variants[0] });
    expect(cartReducer(s, { type: 'setQuantity', key: s[0].key, quantity: 0 })).toEqual([]);
    expect(cartReducer(s, { type: 'remove', key: s[0].key })).toEqual([]);
  });

  test('sync applies server price/stock and drops unavailable items', () => {
    let s = cartReducer([], { type: 'add', product: rice, variant: rice.variants[1], quantity: 8 });
    s = cartReducer(s, { type: 'add', product: ackee, variant: ackee.variants[0] });
    s = cartReducer(s, {
      type: 'sync',
      lines: [
        { productId: 'p1', variantId: 'v2', available: true, price: 30, stock: 5, name: 'Rice', size: '25 lb' },
        { productId: 'p2', variantId: 'v3', available: false },
      ],
    });
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe(lineKey('p1', 'v2'));
    expect(s[0].price).toBe(30);
    expect(s[0].quantity).toBe(5);
  });
});

describe('estimateTotals (matches server pricing)', () => {
  const config = { taxRate: 0.07, deliveryFee: 7.99, freeDeliveryThreshold: 75 };
  test('delivery fee below threshold, tax on discounted subtotal', () => {
    const t = estimateTotals([{ price: 12.99, quantity: 2 }], { deliveryMethod: 'delivery', config, promotion: { type: 'percent', value: 10 } });
    expect(t).toMatchObject({ subtotal: 25.98, discount: 2.6, deliveryFee: 7.99, tax: 1.64, total: 33.01 });
  });
  test('pickup is free and free delivery over threshold', () => {
    expect(estimateTotals([{ price: 10, quantity: 1 }], { deliveryMethod: 'pickup', config }).deliveryFee).toBe(0);
    expect(estimateTotals([{ price: 80, quantity: 1 }], { deliveryMethod: 'delivery', config }).deliveryFee).toBe(0);
  });
});

describe('validateCheckout', () => {
  const valid = { firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.com', phone: '555 123 4567', street: '1 Main', city: 'Atlanta', state: 'GA', zip: '30310', country: 'United States' };
  test('accepts a complete form', () => {
    expect(validateCheckout(valid, 'delivery')).toEqual({});
  });
  test('flags missing and malformed fields', () => {
    const e = validateCheckout({ ...valid, email: 'nope', street: '', zip: '!' }, 'delivery');
    expect(Object.keys(e).sort()).toEqual(['email', 'street', 'zip']);
  });
  test('address is optional for store pickup', () => {
    expect(validateCheckout({ ...valid, street: '', city: '', zip: '' }, 'pickup')).toEqual({});
  });
});
