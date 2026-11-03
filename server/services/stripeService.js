const env = require('../config/env');
const { getStripe } = require('../config/stripe');
const { toCents } = require('./pricingService');

const SESSION_TTL_SECONDS = 30 * 60;

/** Absolute URL for product images so Stripe can display them (only for http(s) hosted images). */
function absoluteImage(image) {
  if (!image) return undefined;
  if (/^https:\/\//.test(image)) return [image];
  return undefined; // local/dev images are not reachable by Stripe; omit them.
}

/**
 * Creates a Stripe Checkout Session for a pending order. Every amount is taken
 * from the server-built order (database prices), never from the client.
 */
async function createCheckoutSession(order) {
  const stripe = getStripe();
  const currency = order.currency || env.currency;

  const line_items = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: toCents(item.unitPrice),
      product_data: {
        name: `${item.name} (${item.size})`,
        ...(item.brand ? { description: item.brand } : {}),
        ...(absoluteImage(item.image) ? { images: absoluteImage(item.image) } : {}),
        metadata: { productId: item.product.toString(), variantId: item.variantId.toString() },
      },
    },
  }));

  if (order.tax > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency, unit_amount: toCents(order.tax), product_data: { name: 'Sales tax' } },
    });
  }

  const params = {
    mode: 'payment',
    line_items,
    customer_email: order.customer.email,
    client_reference_id: order._id.toString(),
    metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    payment_intent_data: { metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber } },
    success_url: `${env.clientUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/checkout?canceled=1&session_id={CHECKOUT_SESSION_ID}`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: order.deliveryMethod === 'pickup' ? 'Store pickup' : 'Home delivery',
          fixed_amount: { amount: toCents(order.deliveryFee), currency },
        },
      },
    ],
  };

  // Discounts are applied as a one-time, single-use coupon for this exact amount.
  if (order.discount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: toCents(order.discount),
      currency,
      duration: 'once',
      max_redemptions: 1,
      name: order.promoCode ? `Promo ${order.promoCode}` : 'Discount',
    });
    params.discounts = [{ coupon: coupon.id }];
  }

  return stripe.checkout.sessions.create(params, { idempotencyKey: `checkout-${order._id}` });
}

module.exports = { createCheckoutSession, SESSION_TTL_SECONDS };
