const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    image: { type: String, default: '' },
    size: { type: String, default: '' },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    // Units no longer with the customer's sale: returned, cancelled or refunded.
    // `restockedQuantity` is the part of those that went back on the shelf.
    returnedQuantity: { type: Number, default: 0, min: 0 },
    restockedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// One entry per return / cancellation / refund that touched the order's items.
const returnSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['return', 'canceled', 'refunded'], default: 'return' },
    reason: { type: String, default: '' },
    note: { type: String, default: '', maxlength: 200 },
    items: [
      {
        _id: false,
        variantId: mongoose.Schema.Types.ObjectId,
        name: String,
        size: String,
        quantity: Number,
        restocked: Boolean,
        value: Number,
      },
    ],
    value: { type: Number, default: 0 },
    userName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  { _id: false }
);

const PAYMENT_STATUSES = ['unpaid', 'paid', 'failed', 'canceled', 'expired', 'refunded'];
const ORDER_STATUSES = ['awaiting_payment', 'processing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'canceled'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    customer: { type: customerSchema, required: true },
    deliveryMethod: { type: String, enum: ['delivery', 'pickup'], required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    promoCode: { type: String, default: '' },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid', index: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'awaiting_payment', index: true },
    stripeSessionId: { type: String, default: undefined },
    stripePaymentIntentId: { type: String, default: '' },
    amountPaid: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
    inventoryAdjusted: { type: Boolean, default: false },
    returns: { type: [returnSchema], default: [] },
    amountRefunded: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null },
    needsReview: { type: Boolean, default: false },
    reviewReason: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.index({ stripeSessionId: 1 }, { unique: true, sparse: true });

orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

orderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Order', orderSchema);
