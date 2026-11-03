const Promotion = require('../models/Promotion');
const AppError = require('../utils/AppError');

/** Looks up a promo code and checks it is usable for the given subtotal. Throws AppError if not. */
async function findValidPromotion(rawCode, subtotal) {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase().slice(0, 30) : '';
  if (!code) return null;

  const promo = await Promotion.findOne({ code });
  if (!promo || !promo.active) throw new AppError('That discount code is not valid.', 422, { promoCode: 'Invalid code' });
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new AppError('That discount code has expired.', 422, { promoCode: 'Code expired' });
  }
  if (promo.usageLimit > 0 && promo.timesUsed >= promo.usageLimit) {
    throw new AppError('That discount code has reached its usage limit.', 422, { promoCode: 'Code no longer available' });
  }
  if (subtotal < promo.minSubtotal) {
    throw new AppError(`This code requires a minimum order of $${promo.minSubtotal.toFixed(2)}.`, 422, {
      promoCode: `Minimum order $${promo.minSubtotal.toFixed(2)}`,
    });
  }
  return promo;
}

module.exports = { findValidPromotion };
