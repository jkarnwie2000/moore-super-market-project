import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { EmptyState, ErrorState, Field, PageLoader, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { formatDate, formatMoney } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const TABS = [
  ['profile', 'Profile', 'user'],
  ['orders', 'Orders', 'receipt'],
  ['addresses', 'Addresses', 'pin'],
];

function ProfileTab() {
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { user: u } = await api.put('/account/profile', form);
      setUser(u);
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }));
      notify('Profile updated');
    } catch (err) {
      setErrors(err.errors || { _: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2>Profile</h2>
      {errors._ && <div className="alert alert--error">{errors._}</div>}
      <div className="form-grid">
        <Field label="Full name" error={errors.name}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email address" hint="Contact us to change your email.">
          <input value={user.email} disabled />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
      </div>
      <h3>Change password</h3>
      <div className="form-grid">
        <Field label="Current password" error={errors.currentPassword}>
          <input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" error={errors.newPassword} hint="Leave blank to keep your current password.">
          <input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
      </div>
      <div>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function OrdersTab() {
  const { data, loading, error, reload } = useApi('/account/orders');
  const [open, setOpen] = useState(null);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.orders.length) {
    return (
      <EmptyState
        icon="receipt"
        title="No orders yet"
        action={
          <Link to="/shop" className="btn btn--primary">
            Start shopping
          </Link>
        }
      >
        When you place an order it will appear here so you can track its status.
      </EmptyState>
    );
  }
  return (
    <div className="stack">
      {data.orders.map((o) => (
        <article key={o.id} className="card order-card">
          <button type="button" className="order-card__head" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
            <span>
              <strong>{o.orderNumber}</strong>
              <small className="muted">
                {formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items · {o.deliveryMethod === 'pickup' ? 'Store pickup' : 'Home delivery'}
              </small>
            </span>
            <span className="order-card__meta">
              <StatusBadge status={o.paymentStatus} />
              <StatusBadge status={o.status} />
              <strong>{formatMoney(o.total)}</strong>
              <Icon name="chevronDown" size={18} />
            </span>
          </button>
          {open === o.id && (
            <ul className="mini-items order-card__items">
              {o.items.map((i) => (
                <li key={`${i.product}-${i.size}`}>
                  <span className="mini-items__img">
                    <ProductImage src={i.image} alt="" />
                    <span className="mini-items__qty">{i.quantity}</span>
                  </span>
                  <span className="mini-items__name">
                    {i.name}
                    <small>
                      {i.size} · {formatMoney(i.unitPrice)} × {i.quantity}
                    </small>
                  </span>
                  <strong>{formatMoney(i.lineTotal)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

const EMPTY_ADDRESS = { label: 'Home', firstName: '', lastName: '', phone: '', street: '', city: '', state: '', zip: '', country: 'United States', isDefault: false };

function AddressForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = initial?._id ? await api.put(`/account/addresses/${initial._id}`, form) : await api.post('/account/addresses', form);
      onSaved(res.user);
    } catch (err) {
      setErrors(err.errors || { _: err.message });
      setSaving(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h3>{initial?._id ? 'Edit address' : 'Add a new address'}</h3>
      {errors._ && <div className="alert alert--error">{errors._}</div>}
      <div className="form-grid">
        <Field label="Label (e.g. Home, Work)">
          <input value={form.label} onChange={set('label')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="First name" error={errors.firstName}>
          <input value={form.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input value={form.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Street address" error={errors.street} className="span-2">
          <input value={form.street} onChange={set('street')} />
        </Field>
        <Field label="City" error={errors.city}>
          <input value={form.city} onChange={set('city')} />
        </Field>
        <Field label="State" error={errors.state}>
          <input value={form.state} onChange={set('state')} />
        </Field>
        <Field label="ZIP code" error={errors.zip}>
          <input value={form.zip} onChange={set('zip')} />
        </Field>
        <Field label="Country" error={errors.country}>
          <input value={form.country} onChange={set('country')} />
        </Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={form.isDefault} onChange={set('isDefault')} /> Use as my default delivery address
      </label>
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save address'}
        </button>
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressesTab() {
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | address

  const saved = (u) => {
    setUser(u);
    setEditing(null);
    notify('Address saved');
  };

  if (editing) return <AddressForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={saved} />;

  return (
    <div className="stack">
      <div className="address-grid">
        {user.addresses.map((a) => (
          <div key={a._id} className={`card address ${a.isDefault ? 'address--default' : ''}`}>
            <p className="address__label">
              {a.label} {a.isDefault && <span className="pill pill--best">Default</span>}
            </p>
            <p>
              {a.firstName} {a.lastName}
              <br />
              {a.street}
              <br />
              {a.city}, {a.state} {a.zip}
              <br />
              {a.country}
              <br />
              {a.phone}
            </p>
            <div className="row">
              <button type="button" className="link-btn" onClick={() => setEditing(a)}>
                <Icon name="edit" size={14} /> Edit
              </button>
              <button
                type="button"
                className="link-btn link-btn--danger"
                onClick={async () => {
                  if (!window.confirm('Delete this address?')) return;
                  const { user: u } = await api.del(`/account/addresses/${a._id}`);
                  setUser(u);
                }}
              >
                <Icon name="trash" size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="card address address--new" onClick={() => setEditing('new')}>
          <Icon name="plus" size={28} />
          Add new address
        </button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  useDocumentTitle('My account');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'profile';

  return (
    <div className="container account">
      <div className="account__head">
        <div>
          <p className="eyebrow">My account</p>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
        </div>
      </div>
      <div className="account__layout">
        <nav className="tabs" aria-label="Account sections">
          {TABS.map(([key, label, icon]) => (
            <button key={key} type="button" className={`tab ${tab === key ? 'is-active' : ''}`} onClick={() => setParams({ tab: key })} aria-current={tab === key ? 'page' : undefined}>
              <Icon name={icon} size={18} /> {label}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'addresses' && <AddressesTab />}
        </div>
      </div>
    </div>
  );
}
