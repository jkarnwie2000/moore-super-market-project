/**
 * Client-side ESTIMATE of order totals for display only. Mirrors
 * server/services/pricingService.js; the server recalculates everything from
 * database prices before payment, so these numbers are never trusted.
 */
const toCents = (n) => Math.round(Number(n) * 100);

export function estimateTotals(items, { deliveryMethod = 'delivery', config, promotion = null }) {
  const cfg = config || { taxRate: 0.07, deliveryFee: 7.99, freeDeliveryThreshold: 75 };
  const subtotalC = items.reduce((s, i) => s + toCents(i.price) * i.quantity, 0);
  let discountC = 0;
  if (promotion) {
    discountC = promotion.type === 'percent' ? Math.round((subtotalC * Math.min(promotion.value, 100)) / 100) : toCents(promotion.value);
    discountC = Math.min(discountC, subtotalC);
  }
  const taxableC = subtotalC - discountC;
  const deliveryC =
    deliveryMethod === 'delivery' && subtotalC > 0 ? (taxableC >= toCents(cfg.freeDeliveryThreshold) ? 0 : toCents(cfg.deliveryFee)) : 0;
  const taxC = Math.round(taxableC * cfg.taxRate);
  return {
    subtotal: subtotalC / 100,
    discount: discountC / 100,
    deliveryFee: deliveryC / 100,
    tax: taxC / 100,
    total: (taxableC + deliveryC + taxC) / 100,
    amountToFreeDelivery: Math.max(0, toCents(cfg.freeDeliveryThreshold) - taxableC) / 100,
  };
}
