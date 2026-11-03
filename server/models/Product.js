const mongoose = require('mongoose');

// A product is sold in one or more package sizes ("variants"), each with its own price and stock.
const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    brand: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    region: { type: String, enum: ['african', 'caribbean'], required: true, index: true },
    origin: { type: String, trim: true, maxlength: 60, default: '' },
    image: { type: String, trim: true, maxlength: 500, default: '' },
    variants: {
      type: [variantSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, 'At least one size/variant is required'],
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    numReviews: { type: Number, min: 0, default: 0 },
    sold: { type: Number, min: 0, default: 0, index: true },
    featured: { type: Boolean, default: false, index: true },
    bestSeller: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },
    // Denormalised from variants on save, for fast filtering and sorting.
    price: { type: Number, min: 0, default: 0, index: true },
    totalStock: { type: Number, min: 0, default: 0 },
    onSale: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

productSchema.methods.syncDerived = function syncDerived() {
  const variants = this.variants || [];
  this.price = variants.length ? Math.min(...variants.map((v) => v.price)) : 0;
  this.totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  this.onSale = variants.some((v) => v.compareAtPrice && v.compareAtPrice > v.price);
};

productSchema.pre('save', function preSave() {
  this.syncDerived();
});

productSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.inStock = ret.totalStock > 0;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Product', productSchema);
