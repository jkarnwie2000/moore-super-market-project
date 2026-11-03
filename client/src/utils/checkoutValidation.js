export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{7,20}$/;
const ZIP_RE = /^[A-Za-z0-9\- ]{3,10}$/;

/** Mirrors the server's validateCustomer() so shoppers get instant feedback. */
export function validateCheckout(form, deliveryMethod) {
  const e = {};
  const v = (k) => (form[k] || '').trim();
  if (!v('firstName')) e.firstName = 'First name is required';
  if (!v('lastName')) e.lastName = 'Last name is required';
  if (!EMAIL_RE.test(v('email'))) e.email = 'Enter a valid email address';
  if (!PHONE_RE.test(v('phone'))) e.phone = 'Enter a valid phone number';
  if (deliveryMethod === 'delivery') {
    if (!v('street')) e.street = 'Street address is required';
    if (!v('city')) e.city = 'City is required';
    if (!v('state')) e.state = 'State is required';
    if (!ZIP_RE.test(v('zip'))) e.zip = 'Enter a valid ZIP code';
    if (!v('country')) e.country = 'Country is required';
  }
  return e;
}
