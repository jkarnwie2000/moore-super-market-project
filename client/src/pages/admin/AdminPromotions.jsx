import { useState } from 'react';
import Icon from '../../components/Icon';
import { ErrorState, Field, PageLoader } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatDate, formatMoney } from '../../utils/format';

const EMPTY = { code: '', description: '', type: 'percent', value: '', minSubtotal: 0, usageLimit: 0, expiresAt: '', active: true };

export default function AdminPromotions() {
  const { data, loading, error, reload } = useApi('/admin/promotions');
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (editingId) await api.put(`/admin/promotions/${editingId}`, form);
      else await api.post('/admin/promotions', form);
      notify(editingId ? 'Promotion updated' : 'Promotion created');
      setForm(EMPTY);
      setEditingId(null);
      reload();
    } catch (err) {
      setErrors(err.errors || { _: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p) {
    await api.put(`/admin/promotions/${p.id}`, { ...p, active: !p.active });
    reload();
  }

  async function remove(p) {
    if (!window.confirm(`Delete promotion ${p.code}?`)) return;
    await api.del(`/admin/promotions/${p.id}`);
    notify('Promotion deleted');
    reload();
  }

  return (
    <div className="stack">
      <div className="admin__head">
        <h1>Promotions &amp; discount codes</h1>
      </div>
      <div className="admin-two">
        <section className="card card--flush">
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Usage</th>
                    <th>Active</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.promotions.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <code className="code">{p.code}</code>
                        <small className="muted block">{p.description}</small>
                      </td>
                      <td>
                        {p.type === 'percent' ? `${p.value}% off` : `${formatMoney(p.value)} off`}
                        {p.minSubtotal > 0 && <small className="muted block">min. {formatMoney(p.minSubtotal)}</small>}
                        {p.expiresAt && <small className="muted block">until {formatDate(p.expiresAt)}</small>}
                      </td>
                      <td>
                        {p.timesUsed}
                        {p.usageLimit > 0 ? ` / ${p.usageLimit}` : ''}
                      </td>
                      <td>
                        <label className="switch">
                          <input type="checkbox" checked={p.active} onChange={() => toggle(p)} aria-label={`Toggle ${p.code}`} />
                          <span />
                        </label>
                      </td>
                      <td className="table__actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${p.code}`}
                          onClick={() => {
                            setEditingId(p.id);
                            setForm({ ...p, expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '' });
                          }}
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${p.code}`} onClick={() => remove(p)}>
                          <Icon name="trash" size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="card stack" onSubmit={submit} noValidate>
          <h2>{editingId ? 'Edit promotion' : 'New promotion'}</h2>
          {errors._ && <div className="alert alert--error">{errors._}</div>}
          <Field label="Code *" error={errors.code} hint="Customers type this at checkout">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={set('description')} />
          </Field>
          <div className="form-grid">
            <Field label="Type *" error={errors.type}>
              <select value={form.type} onChange={set('type')}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </Field>
            <Field label={form.type === 'percent' ? 'Percent *' : 'Amount ($) *'} error={errors.value}>
              <input type="number" min="0" step="0.01" value={form.value} onChange={set('value')} />
            </Field>
            <Field label="Minimum order ($)" error={errors.minSubtotal}>
              <input type="number" min="0" step="0.01" value={form.minSubtotal} onChange={set('minSubtotal')} />
            </Field>
            <Field label="Usage limit" hint="0 = unlimited" error={errors.usageLimit}>
              <input type="number" min="0" step="1" value={form.usageLimit} onChange={set('usageLimit')} />
            </Field>
          </div>
          <Field label="Expires on" error={errors.expiresAt}>
            <input type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </Field>
          <label className="checkbox">
            <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
          </label>
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save promotion' : 'Create promotion'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
