import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { formatMoney } from '../../utils/format';

/** Inline stock/price editor for one product size. */
function VariantInventory({ product, variant, onSaved }) {
  const [stock, setStock] = useState(variant.stock);
  const [price, setPrice] = useState(variant.price);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const dirty = Number(stock) !== variant.stock || Number(price) !== variant.price;

  async function save() {
    setSaving(true);
    try {
      const { product: updated } = await api.patch(`/admin/products/${product.id}/inventory`, { variantId: variant._id, stock: Number(stock), price: Number(price) });
      notify(`Updated ${product.name} (${variant.label})`);
      onSaved(updated);
    } catch (err) {
      notify(err.message, { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inv-row">
      <span className="inv-row__label">{variant.label}</span>
      <label>
        <span className="sr-only">Price for {variant.label}</span>$
        <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label>
        <span className="sr-only">Stock for {variant.label}</span>
        <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className={Number(stock) <= 5 ? 'is-low' : ''} />
      </label>
      {dirty && (
        <button type="button" className="btn btn--primary btn--xs" onClick={save} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
      )}
    </div>
  );
}

export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const { categories } = useStore();
  const [search, setSearch] = useState(params.get('q') || '');
  const query = { q: params.get('q') || '', category: params.get('category') || '', lowStock: params.get('lowStock') || '' };
  const { data, loading, error, reload } = useApi('/admin/products', query);
  const [overrides, setOverrides] = useState({});
  const { notify } = useToast();

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  async function remove(p) {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/products/${p.id}`);
      notify('Product deleted');
      reload();
    } catch (err) {
      notify(err.message, { type: 'error' });
    }
  }

  return (
    <div className="stack">
      <div className="admin__head">
        <h1>Products</h1>
        <Link to="/admin/products/new" className="btn btn--primary">
          + Add product
        </Link>
      </div>

      <div className="admin-filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
          className="admin-search"
        >
          <input type="search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          <button className="btn btn--outline btn--sm" type="submit">
            Search
          </button>
        </form>
        <select aria-label="Filter by category" value={query.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={query.lowStock === '1'} onChange={(e) => update({ lowStock: e.target.checked ? '1' : '' })} /> Low stock only
        </label>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.products.length === 0 ? (
        <EmptyState icon="box" title="No products match" />
      ) : (
        <div className="table-wrap card card--flush">
          <table className="table table--products">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Sizes · price · stock</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.products.map((raw) => {
                const p = overrides[raw.id] || raw;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <ProductImage src={p.image} alt="" />
                        <div>
                          <Link to={`/admin/products/${p.id}`}>
                            <strong>{p.name}</strong>
                          </Link>
                          <small className="muted block">
                            {p.brand} · from {formatMoney(p.price)}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.category?.name}
                      <small className="muted block">{p.region === 'african' ? 'African' : 'Caribbean'}</small>
                    </td>
                    <td>
                      {p.variants.map((v) => (
                        <VariantInventory key={`${v._id}-${v.stock}-${v.price}`} product={p} variant={v} onSaved={(u) => setOverrides((o) => ({ ...o, [u.id]: { ...u, category: p.category } }))} />
                      ))}
                    </td>
                    <td>
                      <div className="pill-stack">
                        {!p.isActive && <span className="pill pill--muted">Hidden</span>}
                        {p.featured && <span className="pill pill--best">Featured</span>}
                        {p.onSale && <span className="pill pill--deal">On sale</span>}
                        {p.totalStock === 0 && <span className="pill pill--muted">Sold out</span>}
                      </div>
                    </td>
                    <td className="table__actions">
                      <Link to={`/admin/products/${p.id}`} className="icon-btn" aria-label={`Edit ${p.name}`}>
                        <Icon name="edit" size={18} />
                      </Link>
                      <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}>
                        <Icon name="trash" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
