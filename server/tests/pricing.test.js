const { describe, test, before, after } = require('node:test');
const { expect } = require('./expect');
const { computeTotals } = require('../services/pricingService');

const config = { taxRate: 0.07, deliveryFee: 7.99, freeDeliveryThreshold: 75, currency: 'usd' };

describe('computeTotals', () => {
  test('sums lines in cents without floating point drift', () => {
    const t = computeTotals(
      [
        { unitPrice: 0.1, quantity: 3 },
        { unitPrice: 19.99, quantity: 1 },
      ],
      { deliveryMethod: 'pickup', config }
    );
    expect(t.subtotal).toBe(20.29);
    expect(t.tax).toBe(1.42); // 20.29 * 0.07 = 1.4203
    expect(t.deliveryFee).toBe(0);
    expect(t.total).toBe(21.71);
  });

  test('charges delivery below the free threshold and waives it above', () => {
    expect(computeTotals([{ unitPrice: 10, quantity: 1 }], { deliveryMethod: 'delivery', config }).deliveryFee).toBe(7.99);
    expect(computeTotals([{ unitPrice: 75, quantity: 1 }], { deliveryMethod: 'delivery', config }).deliveryFee).toBe(0);
  });

  test('applies percent discount before tax and threshold', () => {
    const t = computeTotals([{ unitPrice: 80, quantity: 1 }], {
      deliveryMethod: 'delivery',
      promotion: { type: 'percent', value: 10 },
      config,
    });
    expect(t.discount).toBe(8);
    expect(t.deliveryFee).toBe(7.99); // 72 after discount is below 75
    expect(t.tax).toBe(5.04);
    expect(t.total).toBe(85.03);
  });

  test('fixed discount never exceeds subtotal', () => {
    const t = computeTotals([{ unitPrice: 3, quantity: 1 }], { deliveryMethod: 'pickup', promotion: { type: 'fixed', value: 5 }, config });
    expect(t.discount).toBe(3);
    expect(t.total).toBe(0);
  });
});
