const Order = require('../models/Order');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { str, isObjectId, validateCustomer, PHONE_RE } = require('../utils/validators');
const { toPublicOrder } = require('../services/orderService');
const { validatePassword } = require('./authController');

async function updateProfile(req, res) {
  const name = str(req.body.name, 100);
  const phone = str(req.body.phone, 30);
  const errors = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Please enter a valid phone number.';

  const { currentPassword, newPassword } = req.body;
  let user = req.user;
  if (newPassword) {
    const pwError = validatePassword(newPassword);
    if (pwError) errors.newPassword = pwError;
    user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(String(currentPassword || '')))) errors.currentPassword = 'Current password is incorrect.';
  }
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);

  user.name = name;
  user.phone = phone;
  if (newPassword) user.password = newPassword;
  await user.save();
  res.json({ user: user.toSafeJSON() });
}

function parseAddress(body) {
  const data = validateCustomer({ ...body, email: 'placeholder@example.com' });
  delete data.email;
  return { ...data, label: str(body.label, 40) || 'Home', isDefault: Boolean(body.isDefault) };
}

function applyDefault(user, address) {
  if (address.isDefault || user.addresses.length === 1) {
    user.addresses.forEach((a) => {
      a.isDefault = a._id.equals(address._id);
    });
  }
}

async function addAddress(req, res) {
  if (req.user.addresses.length >= 10) throw new AppError('You can save up to 10 addresses.', 422);
  req.user.addresses.push(parseAddress(req.body));
  const added = req.user.addresses[req.user.addresses.length - 1];
  applyDefault(req.user, added);
  await req.user.save();
  res.status(201).json({ user: req.user.toSafeJSON() });
}

async function updateAddress(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Address not found.', 404);
  const address = req.user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found.', 404);
  address.set(parseAddress(req.body));
  applyDefault(req.user, address);
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}

async function deleteAddress(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Address not found.', 404);
  const address = req.user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found.', 404);
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && req.user.addresses.length) req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}

async function myOrders(req, res) {
  const orders = await Order.find({ user: req.user._id, paymentStatus: { $ne: 'unpaid' } })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ orders: orders.map(toPublicOrder) });
}

async function myOrder(req, res) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found.', 404);
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new AppError('Order not found.', 404);
  res.json({ order: toPublicOrder(order) });
}

module.exports = { updateProfile, addAddress, updateAddress, deleteAddress, myOrders, myOrder };
