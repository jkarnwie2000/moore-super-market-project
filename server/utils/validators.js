const mongoose = require('mongoose');
const AppError = require('./AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{7,20}$/;

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v) && mongoose.Types.ObjectId.isValid(v);

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const toMoney = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
};

const toInt = (v, { min = 0, max = 1000000 } = {}) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
};

/** Validates customer contact + address details. Returns cleaned data or throws AppError with field errors. */
function validateCustomer(input, { requireAddress = true } = {}) {
  const c = input && typeof input === 'object' ? input : {};
  const data = {
    firstName: str(c.firstName, 60),
    lastName: str(c.lastName, 60),
    email: str(c.email, 120).toLowerCase(),
    phone: str(c.phone, 30),
    street: str(c.street, 200),
    city: str(c.city, 80),
    state: str(c.state, 80),
    zip: str(c.zip, 20),
    country: str(c.country, 80),
  };
  const errors = {};
  if (!data.firstName) errors.firstName = 'First name is required';
  if (!data.lastName) errors.lastName = 'Last name is required';
  if (!EMAIL_RE.test(data.email)) errors.email = 'A valid email is required';
  if (!PHONE_RE.test(data.phone)) errors.phone = 'A valid phone number is required';
  if (requireAddress) {
    if (!data.street) errors.street = 'Street address is required';
    if (!data.city) errors.city = 'City is required';
    if (!data.state) errors.state = 'State is required';
    if (!/^[A-Za-z0-9\- ]{3,10}$/.test(data.zip)) errors.zip = 'A valid ZIP code is required';
    if (!data.country) errors.country = 'Country is required';
  }
  if (Object.keys(errors).length) throw new AppError('Please correct the highlighted fields.', 422, errors);
  return data;
}

module.exports = { EMAIL_RE, PHONE_RE, isObjectId, str, escapeRegex, slugify, toMoney, toInt, validateCustomer };
