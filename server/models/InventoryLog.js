const mongoose = require('mongoose');

/**
 * One row per stock movement for a single product size: sales, restocks, manual
 * corrections, damage write-offs and stock returned when a sale is deleted.
 * Product/size names are copied so the history stays readable after a product is deleted.
 */
const REASONS = ['sale', 'restock', 'adjustment', 'damaged', 'returned', 'order_canceled', 'refunded', 'order_deleted'];

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    variantLabel: { type: String, default: '' },
    change: { type: Number, required: true },
    stockAfter: { type: Number, default: null },
    reason: { type: String, enum: REASONS, required: true },
    note: { type: String, default: '', maxlength: 200 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryLogSchema.index({ createdAt: -1 });

inventoryLogSchema.statics.REASONS = REASONS;

inventoryLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
