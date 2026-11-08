import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import Receipt, { PAYMENT_LABELS } from '../../components/admin/Receipt';
import ReturnDialog from '../../components/admin/ReturnDialog';
import { EmptyState, ErrorState, PageLoader, QuantitySelector, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatDateTime, formatMoney } from '../../utils/format';

const METHODS = ['cash', 'card', 'mobile_money', 'other'];

/** Quick cash amounts: exact, then the next round notes above the total. */
function cashSuggestions(total) {
  const out = [];
  for (const note of [5, 10, 20, 50, 100]) {
    const v = Math.ceil(total / note) * note;
    if (v > total && !out.includes(v)) out.push(v);
    if (out.length === 3) break;
  }
  return out;
}

function NewSale({ onCompleted }) {
  const { data, loading, error, reload } = useApi('/admin/inventory');
  const [search, setSearch] = useState('');
  const [ticket, setTicket] = useState([]); // [{ row, quantity }]
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const searchRef = useRef(null);
  const { notify } = useToast();

  const results = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const rows = q ? data.rows.filter((r) => `${r.name} ${r.brand} ${r.label} ${r.category?.name || ''}`.toLowerCase().includes(q)) : data.rows;
    return rows.slice(0, q ? 40 : 24);
  }, [data, search]);

  const inTicket = (variantId) => ticket.find((t) => t.row.variantId === variantId);

  function add(row) {
    if (row.stock === 0) return;
    setTicket((t) => {
      const existing = t.find((x) => x.row.variantId === row.variantId);
      if (existing) return t.map((x) => (x === existing ? { ...x, quantity: Math.min(row.stock, x.quantity + 1) } : x));
      return [...t, { row, quantity: 1 }];
    });
    setSearch('');
    searchRef.current?.focus();
  }

  // Ask the server for authoritative totals whenever the ticket or promo changes.
  const ticketKey = JSON.stringify(ticket.map((t) => [t.row.variantId, t.quantity]));
  useEffect(() => {
    if (!ticket.length) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = await api.post('/admin/in-store/quote', {
          items: ticket.map((t) => ({ productId: t.row.productId, variantId: t.row.variantId, quantity: t.quantity })),
          promoCode: appliedPromo,
        });
        if (!cancelled) {
          setQuote(q);
          setQuoteError('');
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err.message);
          if (appliedPromo && /code|promo|minimum|expired/i.test(err.message)) setAppliedPromo('');
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketKey, appliedPromo]);

  const total = quote?.totals.total ?? 0;
  const tenderedNum = tendered === '' ? total : Number(tendered);
  const change = method === 'cash' && quote ? Math.round((tenderedNum - total) * 100) / 100 : 0;
  const cashShort = method === 'cash' && quote && tenderedNum < total;
  const units = ticket.reduce((s, t) => s + t.quantity, 0);

  function reset() {
    setTicket([]);
    setTendered('');
    setCustomerName('');
    setPromoCode('');
    setAppliedPromo('');
    setMethod('cash');
    setReceipt(null);
    reload();
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  async function complete() {
    setBusy(true);
    try {
      const { order } = await api.post('/admin/in-store/sales', {
        items: ticket.map((t) => ({ productId: t.row.productId, variantId: t.row.variantId, quantity: t.quantity })),
        paymentMethod: method,
        amountTendered: method === 'cash' ? tenderedNum : undefined,
        customerName,
        promoCode: appliedPromo,
      });
      setReceipt(order);
      notify(`Sale ${order.orderNumber} recorded · ${units} ${units === 1 ? 'item' : 'items'} taken from stock`);
      onCompleted();
    } catch (err) {
      notify(err.message, { type: 'error' });
      reload(); // stock may have changed
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="till">
      <section className="card till__finder">
        <label className="till__search">
          <Icon name="search" size={18} />
          <span className="sr-only">Find a product</span>
          <input
            ref={searchRef}
            autoFocus
            type="search"
            placeholder="Find a product, brand or size…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = results.find((r) => r.stock > 0);
                if (first) add(first);
              }
            }}
          />
        </label>
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : results.length === 0 ? (
          <p className="muted small">No products match “{search}”.</p>
        ) : (
          <ul className="till__results" aria-label="Products">
            {results.map((r) => {
              const t = inTicket(r.variantId);
              const left = r.stock - (t ? t.quantity : 0);
              return (
                <li key={r.variantId}>
                  <button type="button" className="till__product" onClick={() => add(r)} disabled={left <= 0}>
                    <ProductImage src={r.image} alt="" />
                    <span className="till__product-name">
                      <strong>{r.name}</strong>
                      <small className="muted">{r.label}</small>
                    </span>
                    <span className="till__product-meta">
                      <strong>{formatMoney(r.price)}</strong>
                      <small className={r.stock === 0 ? 'stock--out' : r.status === 'low' ? 'stock--low' : 'muted'}>
                        {r.stock === 0 ? 'Out of stock' : `${left} left`}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card till__ticket" aria-label="Current sale">
        <div className="admin__head">
          <h2>Current sale</h2>
          {ticket.length > 0 && (
            <button type="button" className="link-btn link-btn--danger" onClick={() => setTicket([])}>
              Clear
            </button>
          )}
        </div>
        {ticket.length === 0 ? (
          <p className="muted till__empty">Search for a product and click it (or press Enter) to add it to the sale.</p>
        ) : (
          <ul className="till__lines">
            {ticket.map((t) => (
              <li key={t.row.variantId}>
                <span className="till__line-name">
                  {t.row.name}
                  <small className="muted block">
                    {t.row.label} · {formatMoney(t.row.price)}
                  </small>
                </span>
                <QuantitySelector
                  size="sm"
                  min={1}
                  max={t.row.stock}
                  value={t.quantity}
                  label={`Quantity of ${t.row.name}`}
                  onChange={(q) => setTicket((all) => all.map((x) => (x === t ? { ...x, quantity: q } : x)))}
                />
                <strong className="till__line-total">{formatMoney(t.row.price * t.quantity)}</strong>
                <button type="button" className="icon-btn icon-btn--danger" aria-label={`Remove ${t.row.name}`} onClick={() => setTicket((all) => all.filter((x) => x !== t))}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="till__promo"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedPromo(promoCode.trim().toUpperCase());
          }}
        >
          <input type="text" placeholder="Discount code (optional)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} aria-label="Discount code" />
          <button type="submit" className="btn btn--outline btn--sm" disabled={!promoCode.trim() || !ticket.length}>
            Apply
          </button>
        </form>
        {quote?.promotion && <p className="small till__applied">✓ {quote.promotion.code}: {quote.promotion.description}</p>}
        {quoteError && (
          <div className="alert alert--error" role="alert">
            {quoteError}
          </div>
        )}

        <dl className="totals">
          <div>
            <dt>
              Subtotal ({units} {units === 1 ? 'item' : 'items'})
            </dt>
            <dd>{formatMoney(quote?.totals.subtotal ?? 0)}</dd>
          </div>
          {quote?.totals.discount > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>−{formatMoney(quote.totals.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Tax</dt>
            <dd>{formatMoney(quote?.totals.tax ?? 0)}</dd>
          </div>
          <div className="totals__grand">
            <dt>Total</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>

        <div className="stack stack--tight">
          <div className="seg" role="group" aria-label="Payment method">
            {METHODS.map((m) => (
              <button key={m} type="button" className={`chip ${method === m ? 'chip--active' : ''}`} aria-pressed={method === m} onClick={() => setMethod(m)}>
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
          {method === 'cash' && (
            <div className="till__cash">
              <label className="field">
                <span className="field__label">Cash received</span>
                <input type="number" inputMode="decimal" min="0" step="0.01" placeholder={total ? total.toFixed(2) : '0.00'} value={tendered} onChange={(e) => setTendered(e.target.value)} />
              </label>
              <div className="row">
                <button type="button" className="chip" onClick={() => setTendered('')}>
                  Exact
                </button>
                {cashSuggestions(total).map((v) => (
                  <button key={v} type="button" className="chip" onClick={() => setTendered(String(v))}>
                    {formatMoney(v)}
                  </button>
                ))}
              </div>
              {quote && (
                <p className={`till__change ${cashShort ? 'is-short' : ''}`} aria-live="polite">
                  {cashShort ? `${formatMoney(total - tenderedNum)} still to pay` : <>Change due <strong>{formatMoney(change)}</strong></>}
                </p>
              )}
            </div>
          )}
          <label className="field">
            <span className="field__label">Customer name (optional)</span>
            <input type="text" maxLength={80} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
          </label>
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!quote || busy || cashShort || !ticket.length} onClick={complete}>
            {busy ? 'Recording…' : `Complete sale${quote ? ` · ${formatMoney(total)}` : ''}`}
          </button>
        </div>
      </section>

      {receipt && <Receipt order={receipt} onClose={reset} onNewSale={reset} />}
    </div>
  );
}

function RecentSales({ refreshKey }) {
  const { data, loading, error, reload } = useApi('/admin/orders', { channel: 'in_store', r: refreshKey });
  const [returning, setReturning] = useState(null);
  const [receipt, setReceipt] = useState(null);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.orders.length) return <EmptyState icon="store" title="No in-store sales yet">Completed till sales will appear here.</EmptyState>;

  return (
    <div className="table-wrap card card--flush">
      <table className="table">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Paid by</th>
            <th>Payment</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {data.orders.map((o) => {
            const returnedUnits = o.items.reduce((s, i) => s + (i.returnedQuantity || 0), 0);
            const remaining = o.items.reduce((s, i) => s + i.quantity, 0) - returnedUnits;
            return (
              <tr key={o.id}>
                <td>
                  <Link to={`/admin/orders?open=${o.id}`}>{o.orderNumber}</Link>
                  <small className="muted block">{formatDateTime(o.paidAt || o.createdAt)}</small>
                </td>
                <td>
                  {o.customer.firstName} {o.customer.lastName}
                  {o.soldBy && <small className="muted block">by {o.soldBy}</small>}
                </td>
                <td>
                  {o.items.reduce((s, i) => s + i.quantity, 0)}
                  {returnedUnits > 0 && <small className="returned-note block">{returnedUnits} returned</small>}
                </td>
                <td>
                  <strong>{formatMoney(o.total)}</strong>
                  {o.amountRefunded > 0 && <small className="muted block">−{formatMoney(o.amountRefunded)} refunded</small>}
                </td>
                <td>{PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}</td>
                <td>
                  <StatusBadge status={o.paymentStatus} />
                </td>
                <td className="table__actions">
                  <div className="row-actions">
                    {remaining > 0 && o.paymentStatus !== 'refunded' && (
                      <button type="button" className="btn btn--outline btn--xs" onClick={() => setReturning(o)}>
                        Return items
                      </button>
                    )}
                    <button type="button" className="icon-btn" title="Show receipt" aria-label={`Show receipt ${o.orderNumber}`} onClick={() => setReceipt(o)}>
                      <Icon name="receipt" size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {returning && (
        <ReturnDialog
          order={returning}
          onClose={() => setReturning(null)}
          onSaved={() => {
            setReturning(null);
            reload();
          }}
        />
      )}
      {receipt && <Receipt order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/** The till, shown as the "In-store sale" tab of the admin dashboard. */
export function InStorePanel() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('view') === 'recent' ? 'recent' : 'new';
  const [refreshKey, setRefreshKey] = useState(0);
  const setTab = (t) => {
    const next = new URLSearchParams(params);
    if (t === 'recent') next.set('view', 'recent');
    else next.delete('view');
    setParams(next, { replace: true });
  };

  return (
    <div className="stack">
      <p className="muted small">Ring up sales made in the shop. Stock is taken off as soon as a sale is completed, and goes back when an item is returned.</p>
      <div className="seg seg--tabs" role="tablist" aria-label="In-store views">
        <button type="button" role="tab" aria-selected={tab === 'new'} className={`chip ${tab === 'new' ? 'chip--active' : ''}`} onClick={() => setTab('new')}>
          <Icon name="cart" size={16} /> New sale
        </button>
        <button type="button" role="tab" aria-selected={tab === 'recent'} className={`chip ${tab === 'recent' ? 'chip--active' : ''}`} onClick={() => setTab('recent')}>
          <Icon name="receipt" size={16} /> Recent sales &amp; returns
        </button>
      </div>
      {tab === 'new' ? <NewSale onCompleted={() => setRefreshKey((k) => k + 1)} /> : <RecentSales refreshKey={refreshKey} />}
    </div>
  );
}
