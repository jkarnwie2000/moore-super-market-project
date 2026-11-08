import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, PageLoader } from '../ui';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { REASON_LABELS } from '../../utils/reporting';

/** Paged list of stock movements, optionally limited to one product size. */
export default function StockHistory({ productId, variantId, showProduct = true, refreshKey = 0 }) {
  const [reason, setReason] = useState('');
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const latest = useRef(0);

  async function load(before) {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/inventory/history', { productId, variantId, reason, before, limit: 50 });
      if (id !== latest.current) return; // a newer request replaced this one
      setLogs((prev) => (before ? [...prev, ...res.logs] : res.logs));
      setHasMore(res.hasMore);
    } catch (err) {
      if (id === latest.current) setError(err);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, variantId, reason, refreshKey]);

  return (
    <div className="stack stack--tight">
      <div className="admin-filters">
        <select aria-label="Filter by type of change" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">All changes</option>
          {Object.entries(REASON_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => load()} />
      ) : logs.length === 0 && loading ? (
        <PageLoader />
      ) : logs.length === 0 ? (
        <p className="muted small">No stock changes recorded yet. Sales, restocks and corrections will appear here.</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>When</th>
                {showProduct && <th>Product</th>}
                <th>Change</th>
                <th>Stock after</th>
                <th>Reason</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{formatDateTime(l.createdAt)}</td>
                  {showProduct && (
                    <td>
                      {l.productName}
                      <small className="muted block">{l.variantLabel}</small>
                    </td>
                  )}
                  <td>
                    <span className={`qty-change ${l.change > 0 ? 'qty-change--up' : 'qty-change--down'}`}>
                      {l.change > 0 ? `+${l.change}` : `−${Math.abs(l.change)}`}
                    </span>
                  </td>
                  <td>{l.stockAfter ?? '—'}</td>
                  <td>{REASON_LABELS[l.reason] || l.reason}</td>
                  <td className="small">
                    {l.orderNumber && l.reason !== 'order_deleted' ? <Link to={`/admin/orders?q=${encodeURIComponent(l.orderNumber)}`}>{l.orderNumber}</Link> : null}
                    {l.note && <span className="block">{l.note}</span>}
                    {l.userName && <span className="muted block">by {l.userName}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <button type="button" className="btn btn--outline btn--sm" disabled={loading} onClick={() => load(logs[logs.length - 1].createdAt)}>
          {loading ? 'Loading…' : 'Load older changes'}
        </button>
      )}
    </div>
  );
}
