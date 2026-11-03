import { useState } from 'react';
import { Field } from '../../components/ui';
import Icon from '../../components/Icon';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const EMPTY = { name: '', region: 'african', description: '', sortOrder: 0 };

export default function AdminCategories() {
  const { categories, reloadCategories } = useStore();
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (editingId) await api.put(`/admin/categories/${editingId}`, form);
      else await api.post('/admin/categories', form);
      await reloadCategories();
      notify(editingId ? 'Category updated' : 'Category created');
      setForm(EMPTY);
      setEditingId(null);
    } catch (err) {
      setErrors(err.errors || { _: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete category “${c.name}”?`)) return;
    try {
      await api.del(`/admin/categories/${c.id}`);
      await reloadCategories();
      notify('Category deleted');
    } catch (err) {
      notify(err.message, { type: 'error' });
    }
  }

  return (
    <div className="stack">
      <div className="admin__head">
        <h1>Categories</h1>
      </div>
      <div className="admin-two">
        <section className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Products</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small className="muted block">{c.description}</small>
                    </td>
                    <td>
                      <span className={`region region--${c.region}`}>{c.region === 'african' ? 'African' : 'Caribbean'}</span>
                    </td>
                    <td>{c.productCount}</td>
                    <td className="table__actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => {
                          setEditingId(c.id);
                          setForm({ name: c.name, region: c.region, description: c.description, sortOrder: c.sortOrder });
                        }}
                      >
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>
                        <Icon name="trash" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form className="card stack" onSubmit={submit} noValidate>
          <h2>{editingId ? 'Edit category' : 'New category'}</h2>
          {errors._ && <div className="alert alert--error">{errors._}</div>}
          <Field label="Name *" error={errors.name}>
            <input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Region *" error={errors.region}>
            <select value={form.region} onChange={set('region')}>
              <option value="african">African groceries</option>
              <option value="caribbean">Caribbean groceries</option>
            </select>
          </Field>
          <Field label="Description">
            <textarea rows="3" value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Sort order">
            <input type="number" min="0" value={form.sortOrder} onChange={set('sortOrder')} />
          </Field>
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save category' : 'Add category'}
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
