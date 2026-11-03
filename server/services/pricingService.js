const env = require('../config/env');

/**
 * Authoritative order pricing. All arithmetic is done in integer cents to avoid
 * floating point drift, then converted back to dollars for storage/display.
 *
 * - Discount applies to the merchandise subtotal.
 * - Tax applies to the discounted merchandise subtotal (not to delivery).
 * - Delivery is free over the threshold (after discount) or for store pickup.
 */
const toCents = (dollars) => Math.round(Number(dollars) * 100);
const toDollars = (cents) => Math.round(cents) / 100;

function pricingConfig() {
  return {
    currency: env.currency,
    taxRate: env.taxRate,
    deliveryFee: env.deliveryFee,
    freeDeliveryThreshold: env.freeDeliveryThreshold,
  };
}

function computeDiscountCents(subtotalCents, promotion) {
  if (!promotion) return 0;
  if (promotion.type === 'percent') {
    const pct = Math.min(Math.max(promotion.value, 0), 100);
    return Math.min(subtotalCents, Math.round((subtotalCents * pct) / 100));
  }
  return Math.min(subtotalCents, toCents(promotion.value));
}

/**
 * @param {Array<{unitPrice:number, quantity:number}>} items
 * @param {{deliveryMethod:'delivery'|'pickup', promotion?:object, config?:object}} options
 */
function computeTotals(items, { deliveryMethod = 'delivery', promotion = null, config = pricingConfig() } = {}) {
  const subtotalCents = items.reduce((sum, i) => sum + toCents(i.unitPrice) * i.quantity, 0);
  const discountCents = computeDiscountCents(subtotalCents, promotion);
  const taxableCents = subtotalCents - discountCents;

  let deliveryCents = 0;
  if (deliveryMethod === 'delivery' && subtotalCents > 0) {
    deliveryCents = taxableCents >= toCents(config.freeDeliveryThreshold) ? 0 : toCents(config.deliveryFee);
  }

  const taxCents = Math.round(taxableCents * config.taxRate);
  const totalCents = taxableCents + deliveryCents + taxCents;

  return {
    subtotal: toDollars(subtotalCents),
    discount: toDollars(discountCents),
    deliveryFee: toDollars(deliveryCents),
    tax: toDollars(taxCents),
    total: toDollars(totalCents),
    cents: { subtotal: subtotalCents, discount: discountCents, delivery: deliveryCents, tax: taxCents, total: totalCents },
  };
}

module.exports = { computeTotals, computeDiscountCents, pricingConfig, toCents, toDollars };
