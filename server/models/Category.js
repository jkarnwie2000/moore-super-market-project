const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    region: { type: String, enum: ['african', 'caribbean'], required: true },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Category', categorySchema);
