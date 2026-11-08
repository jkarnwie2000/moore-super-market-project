import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import AdjustStockDialog from '../../components/admin/AdjustStockDialog';
import StockHistory from '../../components/admin/StockHistory';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { isoDay } from '../../utils/reporting';
import { downloadCsv, toCsv } from '../../utils/csv';

const STATUS = {
  out: ['Out', 'stock--out', 'Out of stock'],
  low: ['Low', 'stock--low', 'Low stock'],
  ok: ['OK', 'stock--in', 'In stock'],
};

const SORTS = {
  stock: ['Lowest stock first', (a, b) => a.stock - b.stock || a.name.localeCompare(b.name)],
  cover: ['Running out soonest', (a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) || a.stock - b.stock],
  sold: ['Best selling (30 days)', (a, b) => b.sold30 - a.sold30 || a.name.localeCompare(b.name)],
  name: ['Name A–Z', (a, b) => a.name.localeCompare(b.name) || a.label.localeCompare(b.label)],
  value: ['Highest stock value', (a, b) => b.stockValue - a.stockValue],
};

function HistoryDrawer({ row, onClose }) {
  return (
    <>
      <div className="drawer-backdrop is-open" onClick={onClose} />
      <aside className="drawer drawer--right drawer--wide is-open" aria-label={`Stock history for ${row.name}`}>
        <div className="drawer__head">
          <h2>
            {row.name} <small className="muted">· {row.label}</small>
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer__body">
          <StockHistory productId={row.productId} variantId={row.variantId} showProduct={false} />
        </div>
      </aside>
    </>
  );
}

export default function AdminInventory() {
  const [params, setParams] = useSearchParams();
  const { categories } = useStore();
  const { data, loading, error, reload } = useApi('/admin/inventory');
  const [adjusting, setAdjusting] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  const tab = params.get('tab') === 'history' ? 'history' : 'levels';
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const category = params.get('category') || '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'stock';
  const [search, setSearch] = useState(q);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.toLowerCase();
    return data.rows
      .filter((r) => (!status ? true : status === 'in' ? r.status !== 'out' : r.status === status))
      .filter((r) => !category || r.category?.id === category)
      .filter((r) => !needle || `${r.name} ${r.brand} ${r.label}`.toLowerCase().includes(needle))
      .sort(SORTS[sort][1]);
  }, [data, q, status, category, sort]);

  function exportCsv() {
    const csv = toCsv(
      [
        { label: 'Product', value: (r) => r.name },
        { label: 'Brand', value: (r) => r.brand },
        { label: 'Size', value: (r) => r.label },
        { label: 'Category', value: (r) => r.category?.name || '' },
        { label: 'Price', value: (r) => r.price.toFixed(2) },
        { label: 'In stock', value: (r) => r.stock },
        { label: 'Status', value: (r) => STATUS[r.status][2] },
        { label: 'Sold (30 days)', value: (r) => r.sold30 },
        { label: 'Days of stock left', value: (r) => (r.daysOfCover ?? '') },
        { label: 'Stock value', value: (r) => r.stockValue.toFixed(2) },
        { label: 'Visible in shop', value: (r) => (r.isActive ? 'Yes' : 'No') },
      ],
      rows
    );
    downloadCsv(`moore-inventory-${isoDay()}.csv`, csv);
  }

  const s = data?.summary;

  return (
    <div className="stack">
      <div className="admin__head">
        <div>
          <h1>Inventory</h1>
          <p className="muted small">Stock for every product size. “Low” means {data?.lowStockThreshold ?? 10} or fewer left.</p>
        </div>
        <div className="row">
          {tab === 'levels' && (
            <button type="button" className="btn btn--outline btn--sm" onClick={exportCsv} disabled={!rows.length}>
              <Icon name="download" size={16} /> Export CSV
            </button>
          )}
          <Link to="/admin/products/new" className="btn btn--primary btn--sm">
            + Add product
          </Link>
        </div>
      </div>

      {s && (
        <div className="stat-grid">
          <div className="stat">
            <span className="stat__label">Product sizes tracked</span>
            <strong className="stat__value">{s.skus}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Units in stock</span>
            <strong className="stat__value">{s.units.toLocaleString()}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Stock value (retail)</span>
            <strong className="stat__value">{formatMoney(s.value)}</strong>
          </div>
          <button type="button" className="stat stat--button stat--warn" onClick={() => update({ tab: '', status: 'low' })}>
            <span className="stat__label">Low stock</span>
            <strong className="stat__value">{s.low}</strong>
          </button>
          <button type="button" className="stat stat--button stat--danger" onClick={() => update({ tab: '', status: 'out' })}>
            <span className="stat__label">Out of stock</span>
            <strong className="stat__value">{s.out}</strong>
          </button>
        </div>
      )}

      <div className="seg seg--tabs" role="tablist" aria-label="Inventory views">
        <button type="button" role="tab" aria-selected={tab === 'levels'} className={`chip ${tab === 'levels' ? 'chip--active' : ''}`} onClick={() => update({ tab: '' })}>
          <Icon name="layers" size={16} /> Stock levels
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={`chip ${tab === 'history' ? 'chip--active' : ''}`} onClick={() => update({ tab: 'history' })}>
          <Icon name="history" size={16} /> Stock history
        </button>
      </div>

      {tab === 'history' ? (
        <section className="card">
          <StockHistory refreshKey={historyKey} />
        </section>
      ) : (
        <>
          <div className="admin-filters">
            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                update({ q: search.trim() });
              }}
            >
              <input type="search" placeholder="Search product, brand or size…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search inventory" />
              <button type="submit" className="btn btn--outline btn--sm">
                Search
              </button>
            </form>
            <select aria-label="Stock status" value={status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="in">In stock</option>
            </select>
            <select aria-label="Category" value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'stock' ? '' : e.target.value })}>
              {Object.entries(SORTS).map(([k, [label]]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {!data && loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState icon="layers" title="Nothing matches these filters" />
          ) : (
            <div className="table-wrap card card--flush">
              <table className="table table--inventory">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>In stock</th>
                    <th title="Units sold in paid orders over the last 30 days">Sold (30d)</th>
                    <th title="Estimated from the last 30 days of sales">Days left</th>
                    <th>Value</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.variantId} className={r.status === 'out' ? 'is-out' : ''}>
                      <td>
                        <div className="table-product table-product--sm">
                          <ProductImage src={r.image} alt="" />
                          <div>
                            <Link to={`/admin/products/${r.productId}`}>
                              <strong>{r.name}</strong>
                            </Link>
                            <small className="muted block">
                              {r.label} · {r.category?.name || 'No category'}
                              {!r.isActive && ' · hidden'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{formatMoney(r.price)}</td>
                      <td>
                        <span className={`stock ${STATUS[r.status][1]}`}>
                          <span className="stock__dot" aria-hidden="true" />
                          <span className="stock__count">{r.stock}</span>
                          <span className="stock__word" title={STATUS[r.status][2]}>
                            {STATUS[r.status][0]}
                          </span>
                        </span>
                      </td>
                      <td>{r.sold30}</td>
                      <td>{r.daysOfCover === null ? <span className="muted">—</span> : r.daysOfCover > 365 ? '365+' : r.daysOfCover}</td>
                      <td>{formatMoney(r.stockValue)}</td>
                      <td className="table__actions">
                        <div className="row-actions">
                        <button type="button" className="icon-btn icon-btn--add" onClick={() => setAdjusting({ row: r, mode: 'add' })} aria-label={`Restock ${r.name} ${r.label}`} title="Restock">
                          <Icon name="plus" size={18} />
                        </button>
                        <button type="button" className="icon-btn" onClick={() => setAdjusting({ row: r, mode: 'set' })} aria-label={`Adjust stock for ${r.name} ${r.label}`} title="Adjust stock">
                          <Icon name="edit" size={18} />
                        </button>
                        <button type="button" className="icon-btn" onClick={() => setHistoryFor(r)} aria-label={`Stock history for ${r.name} ${r.label}`} title="Stock history">
                          <Icon name="history" size={18} />
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {adjusting && (
        <AdjustStockDialog
          row={adjusting.row}
          initialMode={adjusting.mode}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            setHistoryKey((k) => k + 1);
            reload();
          }}
        />
      )}
      {historyFor && <HistoryDrawer row={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
