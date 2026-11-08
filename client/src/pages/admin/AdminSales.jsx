import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import RevenueChart from '../../components/admin/RevenueChart';
import DeleteSalesDialog from '../../components/admin/DeleteSalesDialog';
import { ErrorState, PageLoader, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { formatDateTime, formatMoney, statusLabel } from '../../utils/format';
import { bucketLabel, isoDay, percentChange } from '../../utils/reporting';
import { downloadCsv, toCsv } from '../../utils/csv';

const RANGES = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['12m', '12 months'],
  ['ytd', 'Year to date'],
  ['custom', 'Custom'],
];

function Delta({ current, previous, invert = false }) {
  const pct = percentChange(current, previous);
  if (pct === null) return <span className="delta delta--flat">New this period</span>;
  if (pct === 0) return <span className="delta delta--flat">No change</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span className={`delta ${good ? 'delta--good' : 'delta--bad'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(pct)}%<span className="sr-only">{up ? ' increase' : ' decrease'}</span>
    </span>
  );
}

function BarList({ rows, valueOf, labelOf, formatValue, detailOf, limit = 8 }) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(0, ...rows.map(valueOf));
  if (!rows.length) return <p className="muted small">No sales in this period.</p>;
  const shown = expanded ? rows : rows.slice(0, limit);
  return (
    <>
    <ul className="barlist">
      {shown.map((r) => (
        <li key={labelOf(r)}>
          <div className="barlist__top">
            <span className="barlist__label">{labelOf(r)}</span>
            <strong>{formatValue(valueOf(r))}</strong>
          </div>
          <div className="barlist__track" aria-hidden="true">
            <div className="barlist__fill" style={{ width: `${max ? Math.max(1.5, (valueOf(r) / max) * 100) : 0}%` }} />
          </div>
          {detailOf && <small className="muted">{detailOf(r)}</small>}
        </li>
      ))}
    </ul>
    {rows.length > limit && (
      <button type="button" className="link-btn barlist__more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {expanded ? 'Show fewer' : `Show all ${rows.length}`}
      </button>
    )}
    </>
  );
}

function SalesTable({ query, onChanged }) {
  const [scope, setScope] = useState('paid');
  const params = { ...query, paymentStatus: scope === 'paid' ? 'paid' : '', excludeCanceled: scope === 'paid' ? '1' : '' };
  const { data, loading, error, reload } = useApi('/admin/orders', params);
  const [selected, setSelected] = useState(() => new Set());
  const [toDelete, setToDelete] = useState(null);
  const orders = data?.orders || [];
  const allChecked = orders.length > 0 && orders.every((o) => selected.has(o.id));

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function exportCsv() {
    const csv = toCsv(
      [
        { label: 'Order number', value: (o) => o.orderNumber },
        { label: 'Placed', value: (o) => formatDateTime(o.createdAt) },
        { label: 'Paid', value: (o) => (o.paidAt ? formatDateTime(o.paidAt) : '') },
        { label: 'Customer', value: (o) => `${o.customer.firstName} ${o.customer.lastName}` },
        { label: 'Email', value: (o) => o.customer.email },
        { label: 'Channel', value: (o) => (o.channel === 'in_store' ? 'In store' : 'Online') },
        { label: 'Fulfilment', value: (o) => (o.channel === 'in_store' ? 'In store' : o.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery') },
        { label: 'Paid by', value: (o) => ({ stripe: 'Stripe', cash: 'Cash', card: 'Card', mobile_money: 'Mobile money', other: 'Other' })[o.paymentMethod || 'stripe'] },
        { label: 'Items', value: (o) => o.items.map((i) => `${i.name} (${i.size}) x${i.quantity}`).join('; ') },
        { label: 'Units', value: (o) => o.items.reduce((n, i) => n + i.quantity, 0) },
        { label: 'Subtotal', value: (o) => o.subtotal.toFixed(2) },
        { label: 'Discount', value: (o) => (o.discount || 0).toFixed(2) },
        { label: 'Promo code', value: (o) => o.promoCode || '' },
        { label: 'Delivery fee', value: (o) => (o.deliveryFee || 0).toFixed(2) },
        { label: 'Tax', value: (o) => (o.tax || 0).toFixed(2) },
        { label: 'Total', value: (o) => o.total.toFixed(2) },
        { label: 'Payment', value: (o) => statusLabel(o.paymentStatus) },
        { label: 'Status', value: (o) => statusLabel(o.status) },
      ],
      orders
    );
    downloadCsv(`moore-sales-${query.from || query.range}-${query.to || isoDay()}.csv`, csv);
  }

  return (
    <section className="card card--flush">
      <div className="card__bar">
        <div>
          <h2>{scope === 'paid' ? 'Sales in this period' : 'All orders in this period'}</h2>
          <p className="muted small">{scope === 'paid' ? 'Paid orders, by payment date.' : 'Every order placed, including unpaid, expired and cancelled ones.'}</p>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Which orders to show">
            <button type="button" className={`chip ${scope === 'paid' ? 'chip--active' : ''}`} aria-pressed={scope === 'paid'} onClick={() => { setScope('paid'); setSelected(new Set()); }}>
              Paid sales
            </button>
            <button type="button" className={`chip ${scope === 'all' ? 'chip--active' : ''}`} aria-pressed={scope === 'all'} onClick={() => { setScope('all'); setSelected(new Set()); }}>
              All orders
            </button>
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={exportCsv} disabled={!orders.length}>
            <Icon name="download" size={16} /> Export CSV
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Selected sales">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          <button type="button" className="link-btn" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => setToDelete(orders.filter((o) => selected.has(o.id)))}>
            <Icon name="trash" size={16} /> Delete selected
          </button>
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : orders.length === 0 ? (
        <p className="muted card__empty">{scope === 'paid' ? 'No paid sales in this period.' : 'No orders in this period.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="table__check">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(orders.map((o) => o.id)))}
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={selected.has(o.id) ? 'is-selected' : ''}>
                  <td className="table__check">
                    <input type="checkbox" aria-label={`Select ${o.orderNumber}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  </td>
                  <td>
                    <Link to={`/admin/orders?open=${o.id}`}>{o.orderNumber}</Link>
                    <small className="muted block">{formatDateTime(o.paidAt || o.createdAt)}</small>
                  </td>
                  <td>
                    {o.customer.firstName} {o.customer.lastName}
                    <small className="muted block">{o.channel === 'in_store' ? 'In store' : o.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</small>
                  </td>
                  <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td>
                    <strong>{formatMoney(o.total)}</strong>
                  </td>
                  <td>
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="table__actions">
                    <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${o.orderNumber}`} onClick={() => setToDelete([o])}>
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length >= 500 && <p className="muted small card__empty">Showing the 500 most recent. Narrow the date range to see older orders.</p>}
        </div>
      )}

      {toDelete && (
        <DeleteSalesDialog
          orders={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setToDelete(null);
            setSelected(new Set());
            reload();
            onChanged();
          }}
        />
      )}
    </section>
  );
}

export default function AdminSales() {
  const [params, setParams] = useSearchParams();
  const range = params.get('range') || '30d';
  const [customFrom, setCustomFrom] = useState(params.get('from') || isoDay(new Date(Date.now() - 29 * 86400000)));
  const [customTo, setCustomTo] = useState(params.get('to') || isoDay());
  const [showTable, setShowTable] = useState(false);

  // useApi re-fetches only when the serialised query changes, so a fresh object each render is fine.
  const query = range === 'custom' ? { from: params.get('from') || customFrom, to: params.get('to') || customTo } : { range };
  const { data, loading, error, reload } = useApi('/admin/sales', query);

  const setRange = (r) => {
    const next = new URLSearchParams();
    next.set('range', r);
    if (r === 'custom') {
      next.set('from', customFrom);
      next.set('to', customTo);
    }
    setParams(next);
  };

  const s = data?.summary;
  const p = data?.previous;
  const tiles = s
    ? [
        ['Gross sales', formatMoney(s.grossSales), s.grossSales, p.grossSales, 'Everything customers paid, including tax and delivery', false, s.refunds ? `${formatMoney(s.refunds)} partly refunded` : ''],
        ['Orders', s.orders, s.orders, p.orders],
        ['Average order', formatMoney(s.averageOrder), s.averageOrder, p.averageOrder],
        ['Items sold', s.itemsSold, s.itemsSold, p.itemsSold, null, false, s.returnedUnits ? `${s.returnedUnits} returned (${formatMoney(s.returnsValue)})` : ''],
        ['Net product sales', formatMoney(s.netSales), s.netSales, p.netSales, 'Products after discounts, before tax and delivery'],
        ['Discounts given', formatMoney(s.discounts), s.discounts, p.discounts, null, true],
      ]
    : [];
  const listQuery = data ? { from: data.period.from, to: data.period.to } : null;

  return (
    <div className="stack">
      <div className="admin__head">
        <div>
          <h1>Sales</h1>
          {data && (
            <p className="muted small">
              {bucketLabel(data.period.from, { withYear: true })} – {bucketLabel(data.period.to, { withYear: true })} · compared with{' '}
              {bucketLabel(data.period.previousFrom, { withYear: true })} – {bucketLabel(data.period.previousTo, { withYear: true })}
            </p>
          )}
        </div>
      </div>

      <div className="admin-filters">
        <div className="seg" role="group" aria-label="Report period">
          {RANGES.map(([key, label]) => (
            <button key={key} type="button" className={`chip ${range === key ? 'chip--active' : ''}`} aria-pressed={range === key} onClick={() => setRange(key)}>
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <form
            className="date-range"
            onSubmit={(e) => {
              e.preventDefault();
              setRange('custom');
            }}
          >
            <label>
              <span className="sr-only">From</span>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} required />
            </label>
            <span aria-hidden="true">–</span>
            <label>
              <span className="sr-only">To</span>
              <input type="date" value={customTo} min={customFrom} max={isoDay()} onChange={(e) => setCustomTo(e.target.value)} required />
            </label>
            <button type="submit" className="btn btn--primary btn--sm">
              Apply
            </button>
          </form>
        )}
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className={`stat-grid stat-grid--6 ${loading ? 'is-loading' : ''}`}>
            {tiles.map(([label, shown, cur, prev, hint, invert, extra]) => (
              <div key={label} className="stat" title={hint || undefined}>
                <span className="stat__label">{label}</span>
                <strong className="stat__value">{shown}</strong>
                <Delta current={cur} previous={prev} invert={invert} />
                {extra && <span className="stat__extra">{extra}</span>}
              </div>
            ))}
          </div>

          <section className="card">
            <div className="admin__head">
              <div>
                <h2>Gross sales per {data.period.bucket}</h2>
                <p className="muted small">Paid orders, in the store's time zone ({data.period.timezone.replace('_', ' ')}).</p>
              </div>
              <button type="button" className="link-btn" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
                {showTable ? 'Show chart' : 'Show as table'}
              </button>
            </div>
            {showTable ? (
              <div className="table-wrap table-wrap--scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{data.period.bucket === 'month' ? 'Month' : 'Day'}</th>
                      <th>Orders</th>
                      <th>Gross sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.series].reverse().map((d) => (
                      <tr key={d.key}>
                        <td>{bucketLabel(d.key, { withYear: true })}</td>
                        <td>{d.orders}</td>
                        <td>{formatMoney(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <RevenueChart series={data.series} />
            )}
          </section>

          <div className="admin-two">
            <section className="card">
              <h2>Top products</h2>
              {data.topProducts.length === 0 ? (
                <p className="muted small">No sales in this period.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Units</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((tp) => (
                        <tr key={tp.productId}>
                          <td>
                            <div className="table-product table-product--sm">
                              <ProductImage src={tp.image} alt="" />
                              <span>{tp.name}</span>
                            </div>
                          </td>
                          <td>{tp.quantity}</td>
                          <td>{formatMoney(tp.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <div className="stack">
              <section className="card">
                <h2>Sales by category</h2>
                <BarList
                  rows={data.byCategory}
                  valueOf={(r) => r.revenue}
                  labelOf={(r) => r.name}
                  formatValue={formatMoney}
                  detailOf={(r) => `${r.quantity} ${r.quantity === 1 ? 'unit' : 'units'}`}
                />
              </section>
              <section className="card">
                <h2>Online vs in store</h2>
                <BarList
                  rows={data.byChannel}
                  valueOf={(r) => r.revenue}
                  labelOf={(r) => (r.channel === 'in_store' ? 'In-store sales' : 'Online orders')}
                  formatValue={formatMoney}
                  detailOf={(r) => `${r.orders} ${r.orders === 1 ? 'sale' : 'sales'}`}
                />
              </section>
              <section className="card">
                <h2>Online: delivery vs pickup</h2>
                <BarList
                  rows={data.byFulfilment}
                  valueOf={(r) => r.revenue}
                  labelOf={(r) => (r.method === 'pickup' ? 'Store pickup' : 'Home delivery')}
                  formatValue={formatMoney}
                  detailOf={(r) => `${r.orders} ${r.orders === 1 ? 'order' : 'orders'}`}
                />
              </section>
            </div>
          </div>

          {listQuery && <SalesTable key={`${listQuery.from}-${listQuery.to}`} query={listQuery} onChanged={reload} />}
        </>
      )}
    </div>
  );
}
