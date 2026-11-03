import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import OrderSummary from '../components/OrderSummary';
import ProductImage from '../components/ProductImage';
import { Field } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { estimateTotals } from '../utils/pricing';
import { formatMoney } from '../utils/format';
import { validateCheckout } from '../utils/checkoutValidation';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const DRAFT_KEY = 'moore_checkout_draft';
const EMPTY = { firstName: '', lastName: '', email: '', phone: '', street: '', city: '', state: '', zip: '', country: 'United States' };

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  useDocumentTitle('Checkout');
  const { items, refresh } = useCart();
  const { user } = useAuth();
  const { config } = useStore();
  const [params, setParams] = useSearchParams();
  const draft = useRef(loadDraft());

  const [form, setForm] = useState(draft.current?.form || EMPTY);
  const [deliveryMethod, setDeliveryMethod] = useState(draft.current?.deliveryMethod || 'delivery');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [promoInput, setPromoInput] = useState(draft.current?.promoCode || '');
  const [promo, setPromo] = useState(null); // { code, type, value, description }
  const [promoState, setPromoState] = useState({ loading: false, error: '' });

  // Prefill from the signed-in customer's default address.
  useEffect(() => {
    if (!user || draft.current) return;
    const addr = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
    const [first = '', ...rest] = user.name.split(' ');
    setForm((f) => ({
      ...f,
      email: f.email || user.email,
      firstName: f.firstName || addr?.firstName || first,
      lastName: f.lastName || addr?.lastName || rest.join(' '),
      phone: f.phone || addr?.phone || user.phone || '',
      ...(addr && !f.street ? { street: addr.street, city: addr.city, state: addr.state, zip: addr.zip, country: addr.country } : {}),
    }));
  }, [user]);

  // Returning from Stripe via "back": release the abandoned session.
  useEffect(() => {
    if (params.get('canceled') !== '1') return;
    const sessionId = params.get('session_id');
    setNotice('Payment was canceled — you have not been charged. Your cart has been saved, so you can try again whenever you’re ready.');
    if (sessionId) api.post('/checkout/cancel', { sessionId }).catch(() => {});
    refresh();
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply a remembered promo code.
  useEffect(() => {
    if (draft.current?.promoCode && items.length) applyPromo(draft.current.promoCode, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, deliveryMethod, promoCode: promo?.code || '' }));
    } catch {
      /* ignore */
    }
  }, [form, deliveryMethod, promo]);

  const totals = useMemo(() => estimateTotals(items, { deliveryMethod, config, promotion: promo }), [items, deliveryMethod, config, promo]);

  if (!items.length) return <Navigate to="/cart" replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const cartPayload = () => items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));

  async function applyPromo(code = promoInput, silent = false) {
    const clean = code.trim();
    if (!clean) return;
    setPromoState({ loading: true, error: '' });
    try {
      const res = await api.post('/checkout/quote', { items: cartPayload(), deliveryMethod, promoCode: clean });
      setPromo(res.promotion);
      setPromoState({ loading: false, error: '' });
    } catch (err) {
      setPromo(null);
      setPromoState({ loading: false, error: silent ? '' : err.errors?.promoCode ? err.message : err.message });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const found = validateCheckout(form, deliveryMethod);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Please complete the highlighted fields.');
      document.querySelector('.field--error input, .field--error select')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await api.post('/checkout/session', {
        items: cartPayload(),
        customer: form,
        deliveryMethod,
        promoCode: promo?.code || '',
      });
      window.location.assign(url); // Stripe-hosted, PCI-compliant payment page
    } catch (err) {
      setSubmitting(false);
      if (err.errors && !err.errors.items) setErrors(err.errors);
      if (err.status === 409) refresh();
      setFormError(err.message);
    }
  }

  return (
    <div className="container checkout">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/cart">Cart</Link> <Icon name="chevronRight" size={14} /> <span>Checkout</span> <Icon name="chevronRight" size={14} />
        <span className="muted">Payment</span>
      </nav>
      <h1>Checkout</h1>

      {notice && (
        <div className="alert alert--warning" role="status">
          {notice}
        </div>
      )}
      {!config.stripeEnabled && (
        <div className="alert alert--warning" role="alert">
          Online payments are not configured yet. The store owner needs to add Stripe API keys before orders can be paid.
        </div>
      )}

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="checkout-main">
          <section className="card">
            <h2>
              <span className="step">1</span> How would you like to receive your order?
            </h2>
            <div className="delivery-options">
              <label className={`delivery-option ${deliveryMethod === 'delivery' ? 'is-selected' : ''}`}>
                <input type="radio" name="deliveryMethod" value="delivery" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} />
                <Icon name="truck" size={26} />
                <span>
                  <strong>Home delivery</strong>
                  <small>
                    {formatMoney(config.deliveryFee)} · FREE over {formatMoney(config.freeDeliveryThreshold)}
                  </small>
                </span>
              </label>
              <label className={`delivery-option ${deliveryMethod === 'pickup' ? 'is-selected' : ''}`}>
                <input type="radio" name="deliveryMethod" value="pickup" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} />
                <Icon name="store" size={26} />
                <span>
                  <strong>Store pickup</strong>
                  <small>FREE · Ready in 2 hours</small>
                </span>
              </label>
            </div>
            {deliveryMethod === 'pickup' && (
              <p className="muted small">
                <Icon name="pin" size={14} /> Pick up at {config.storeAddress || 'Moore Supermarket'} — we’ll email you when your order is ready.
              </p>
            )}
          </section>

          <section className="card">
            <h2>
              <span className="step">2</span> Contact information
            </h2>
            <div className="form-grid">
              <Field label="First name *" error={errors.firstName}>
                <input autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name *" error={errors.lastName}>
                <input autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
              </Field>
              <Field label="Email address *" error={errors.email}>
                <input type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              </Field>
              <Field label="Phone number *" error={errors.phone}>
                <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
              </Field>
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="step">3</span> {deliveryMethod === 'delivery' ? 'Delivery address' : 'Billing address (optional for pickup)'}
            </h2>
            <div className="form-grid">
              <Field label={`Street address${deliveryMethod === 'delivery' ? ' *' : ''}`} error={errors.street} className="span-2">
                <input autoComplete="street-address" value={form.street} onChange={set('street')} />
              </Field>
              <Field label={`City${deliveryMethod === 'delivery' ? ' *' : ''}`} error={errors.city}>
                <input autoComplete="address-level2" value={form.city} onChange={set('city')} />
              </Field>
              <Field label={`State${deliveryMethod === 'delivery' ? ' *' : ''}`} error={errors.state}>
                <input autoComplete="address-level1" value={form.state} onChange={set('state')} />
              </Field>
              <Field label={`ZIP code${deliveryMethod === 'delivery' ? ' *' : ''}`} error={errors.zip}>
                <input autoComplete="postal-code" value={form.zip} onChange={set('zip')} />
              </Field>
              <Field label={`Country${deliveryMethod === 'delivery' ? ' *' : ''}`} error={errors.country}>
                <select autoComplete="country-name" value={form.country} onChange={set('country')}>
                  {['United States', 'Canada', 'United Kingdom'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
        </div>

        <aside className="summary-card checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="mini-items">
            {items.map((i) => (
              <li key={i.key}>
                <span className="mini-items__img">
                  <ProductImage src={i.image} alt="" />
                  <span className="mini-items__qty">{i.quantity}</span>
                </span>
                <span className="mini-items__name">
                  {i.name}
                  <small>
                    {i.size} · {formatMoney(i.price)} × {i.quantity}
                  </small>
                </span>
                <strong>{formatMoney(i.price * i.quantity)}</strong>
              </li>
            ))}
          </ul>

          <div className="promo-field">
            <label htmlFor="promo" className="sr-only">
              Discount code
            </label>
            <input
              id="promo"
              placeholder="Discount code"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyPromo();
                }
              }}
            />
            {promo ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  setPromo(null);
                  setPromoInput('');
                }}
              >
                Remove
              </button>
            ) : (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => applyPromo()} disabled={promoState.loading}>
                {promoState.loading ? '…' : 'Apply'}
              </button>
            )}
          </div>
          {promoState.error && <p className="field__error">{promoState.error}</p>}
          {promo && (
            <p className="promo-applied">
              <Icon name="tag" size={14} /> {promo.code} applied{promo.description ? ` — ${promo.description}` : ''}
            </p>
          )}

          <OrderSummary totals={totals} deliveryMethod={deliveryMethod} promoCode={promo?.code} />

          {formError && (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--lg btn--block pay-btn" disabled={submitting}>
            {submitting ? (
              'Redirecting to secure payment…'
            ) : (
              <>
                <Icon name="shield" size={18} /> PAY NOW · {formatMoney(totals.total)}
              </>
            )}
          </button>
          <p className="secure-note">
            You’ll complete payment on Stripe’s secure checkout page. We never see or store your card details.
          </p>
          {config.stripeTestMode && (
            <p className="test-note">
              <strong>Test mode:</strong> use card 4242 4242 4242 4242, any future date and any CVC.
            </p>
          )}
        </aside>
      </form>
    </div>
  );
}
