const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: 'Home' },
    firstName: { type: String, trim: true, maxlength: 60, required: true },
    lastName: { type: String, trim: true, maxlength: 60, required: true },
    phone: { type: String, trim: true, maxlength: 30, required: true },
    street: { type: String, trim: true, maxlength: 200, required: true },
    city: { type: String, trim: true, maxlength: 80, required: true },
    state: { type: String, trim: true, maxlength: 80, required: true },
    zip: { type: String, trim: true, maxlength: 20, required: true },
    country: { type: String, trim: true, maxlength: 80, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    addresses: this.addresses,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
