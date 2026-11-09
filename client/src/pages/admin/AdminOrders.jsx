import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import DeleteSalesDialog from '../../components/admin/DeleteSalesDialog';
import ReturnDialog, { RETURN_REASONS } from '../../components/admin/ReturnDialog';
import Modal from '../../components/admin/Modal';
import { EmptyState, ErrorState, PageLoader, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatDateTime, formatMoney, statusLabel } from '../../utils/format';

const ORDER_STATUSES = ['awaiting_payment', 'processing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'canceled'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'failed', 'canceled', 'expired', 'refunded'];

/** "customer:sent store:failed" → "Customer ✓ sent · Store ✗ failed" */
function emailSummary(status = '') {
  const label = { sent: '✓ sent', failed: '✗ failed', 'not-configured': 'not sent (email off)', none: '—' };
  const parts = Object.fromEntries(status.split(' ').map((p) => p.split(':')));
  return `Customer ${label[parts.customer] || '—'} · Store ${label[parts.store] || '—'}`;
}

function OrderDetail({ id, onClose, onUpdated }) {
  const { data, loading, error } = useApi(`/admin/orders/${id}`);
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [returning, setReturning] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelRestock, setCancelRestock] = useState(true);
  const { notify } = useToast();
  useEffect(() => {
    if (data) setOrder(data.order);
  }, [data]);

  async function setStatus(status, resolveReview = false, restock = true) {
    setSaving(true);
    try {
      const { order: o, unitsRestocked } = await api.patch(`/admin/orders/${id}/status`, { status, resolveReview, restock });
      setOrder(o);
      onUpdated();
      notify(`Order ${o.orderNumber} → ${statusLabel(status)}${unitsRestocked ? ` · ${unitsRestocked} ${unitsRestocked === 1 ? 'item' : 'items'} back in stock` : ''}`);
    } catch (err) {
      notify(err.message, { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const unreturned = order ? order.items.reduce((s, i) => s + i.quantity - (i.returnedQuantity || 0), 0) : 0;
  const canReturn = order && ['paid', 'refunded'].includes(order.paymentStatus) && order.inventoryAdjusted && unreturned > 0;
  const lockedCanceled = order && order.status === 'canceled' && order.paymentStatus === 'paid' && order.inventoryAdjusted;

  function onStatusChange(status) {
    // Cancelling a paid order puts stock back, so confirm it first.
    if (status === 'canceled' && order.paymentStatus === 'paid' && order.status !== 'canceled') {
      setCancelRestock(true);
      setConfirmCancel(true);
      return;
    }
    setStatus(status);
  }

  return (
    <>
      <div className="drawer-backdrop is-open" onClick={onClose} />
      <aside className="drawer drawer--right is-open" aria-label="Order details">
        <div className="drawer__head">
          <h2>{order ? order.orderNumber : 'Order'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer__body stack">
          {loading || !order ? (
            error ? <ErrorState error={error} /> : <PageLoader />
          ) : (
            <>
              {order.needsReview && (
                <div className="alert alert--warning">
                  <strong>Needs review:</strong> {order.reviewReason}
                  <button type="button" className="link-btn" onClick={() => setStatus(order.status, true)}>
                    Mark resolved
                  </button>
                </div>
              )}
              <div className="row">
                <StatusBadge status={order.paymentStatus} />
                <StatusBadge status={order.status} />
              </div>
              <label className="field">
                <span className="field__label">Update order status</span>
                <select value={order.status} disabled={saving || lockedCanceled} onChange={(e) => onStatusChange(e.target.value)}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={order.paymentStatus !== 'paid' && !['canceled', 'awaiting_payment'].includes(s)}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                {lockedCanceled && <span className="field__hint">Cancelled — its items were returned to stock, so it can't be reopened.</span>}
              </label>
              {canReturn && (
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setReturning(true)}>
                  <Icon name="history" size={16} /> Record a return
                </button>
              )}
              <dl className="details">
                <div>
                  <dt>Placed</dt>
                  <dd>{formatDateTime(order.createdAt)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{order.paidAt ? formatDateTime(order.paidAt) : '—'}</dd>
                </div>
                {order.emailsSentAt && (
                  <div>
                    <dt>Emails</dt>
                    <dd>{emailSummary(order.emailStatus)}</dd>
                  </div>
                )}
                <div>
                  <dt>Fulfilment</dt>
                  <dd>{order.deliveryMethod === 'pickup' ? 'Store pickup' : 'Home delivery'}</dd>
                </div>
                <div>
                  <dt>Stripe payment</dt>
                  <dd className="mono">{order.stripePaymentIntentId || '—'}</dd>
                </div>
              </dl>
              <div>
                <h3>Customer</h3>
                <p>
                  {order.customer.firstName} {order.customer.lastName} · {order.customer.email} · {order.customer.phone}
                  {order.customer.street && (
                    <>
                      <br />
                      {order.customer.street}, {order.customer.city}, {order.customer.state} {order.customer.zip}, {order.customer.country}
                    </>
                  )}
                </p>
                {order.user && <p className="muted small">Registered customer: {order.user.email}</p>}
              </div>
              <div>
                <h3>Items</h3>
                <table className="table">
                  <tbody>
                    {order.items.map((i) => (
                      <tr key={`${i.product}-${i.size}`}>
                        <td>
                          {i.name}
                          <small className="muted block">{i.size}</small>
                          {i.returnedQuantity > 0 && (
                            <small className="returned-note block">
                              {i.returnedQuantity} returned
                              {i.restockedQuantity > 0 ? ` · ${i.restockedQuantity} restocked` : ' · not restocked'}
                            </small>
                          )}
                        </td>
                        <td>× {i.quantity}</td>
                        <td>{formatMoney(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {order.returns?.length > 0 && (
                <div>
                  <h3>Returns &amp; stock changes</h3>
                  <ul className="return-log">
                    {[...order.returns].reverse().map((r) => (
                      <li key={r._id}>
                        <div className="return-log__head">
                          <strong>{r.kind === 'refunded' ? 'Refunded in Stripe' : r.kind === 'canceled' ? 'Order cancelled' : RETURN_REASONS[r.reason] || 'Return'}</strong>
                          <span className="muted small">{formatDateTime(r.createdAt)}</span>
                        </div>
                        <span className="small">
                          {r.items.map((i) => `${i.quantity} × ${i.name} (${i.size})${i.restocked ? '' : ' — not restocked'}`).join('; ')}
                        </span>
                        <span className="muted small">
                          {formatMoney(r.value)} of goods{r.userName ? ` · by ${r.userName}` : ''}
                          {r.note ? ` · ${r.note}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <dl className="totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(order.subtotal)}</dd>
                </div>
                {order.discount > 0 && (
                  <div>
                    <dt>Discount ({order.promoCode})</dt>
                    <dd>−{formatMoney(order.discount)}</dd>
                  </div>
                )}
                <div>
                  <dt>Delivery</dt>
                  <dd>{formatMoney(order.deliveryFee)}</dd>
                </div>
                <div>
                  <dt>Tax</dt>
                  <dd>{formatMoney(order.tax)}</dd>
                </div>
                <div className="totals__grand">
                  <dt>Total</dt>
                  <dd>{formatMoney(order.total)}</dd>
                </div>
                {['paid', 'refunded'].includes(order.paymentStatus) && (
                  <div>
                    <dt>Amount charged</dt>
                    <dd>{formatMoney(order.amountPaid)}</dd>
                  </div>
                )}
                {order.amountRefunded > 0 && (
                  <div>
                    <dt>Refunded in Stripe</dt>
                    <dd>−{formatMoney(order.amountRefunded)}</dd>
                  </div>
                )}
              </dl>
              <div className="danger-zone">
                <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" size={16} /> Delete this order
                </button>
              </div>
              {confirmDelete && (
                <DeleteSalesDialog
                  orders={[order]}
                  onClose={() => setConfirmDelete(false)}
                  onDeleted={() => {
                    onUpdated();
                    onClose();
                  }}
                />
              )}
              {returning && (
                <ReturnDialog
                  order={order}
                  onClose={() => setReturning(false)}
                  onSaved={(o) => {
                    setReturning(false);
                    setOrder(o);
                    onUpdated();
                  }}
                />
              )}
              {confirmCancel && (
                <Modal
                  title={`Cancel ${order.orderNumber}?`}
                  onClose={() => setConfirmCancel(false)}
                  footer={
                    <>
                      <button type="button" className="btn btn--outline" onClick={() => setConfirmCancel(false)}>
                        Keep order
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={saving}
                        onClick={async () => {
                          await setStatus('canceled', false, cancelRestock);
                          setConfirmCancel(false);
                        }}
                      >
                        Cancel order
                      </button>
                    </>
                  }
                >
                  <div className="stack stack--tight">
                    <p>This order has been paid. Cancelling it can't be undone.</p>
                    {order.inventoryAdjusted && unreturned > 0 && (
                      <label className="checkbox">
                        <input type="checkbox" checked={cancelRestock} onChange={(e) => setCancelRestock(e.target.checked)} />
                        Put {unreturned} {unreturned === 1 ? 'item' : 'items'} back in stock
                      </label>
                    )}
                    <div className="alert alert--warning">
                      <span>Cancelling doesn't refund the customer. Refund the payment in your Stripe dashboard. If you refund in Stripe first, the order is cancelled and restocked automatically.</span>
                    </div>
                  </div>
                </Modal>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const query = { paymentStatus: params.get('paymentStatus') || '', status: params.get('status') || '', q: params.get('q') || '' };
  const { data, loading, error, reload } = useApi('/admin/orders', query);
  const openId = params.get('open');

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  return (
    <div className="stack">
      <div className="admin__head">
        <h1>Orders</h1>
      </div>
      <div className="admin-filters">
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <input type="search" placeholder="Order #, email or last name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search orders" />
          <button type="submit" className="btn btn--outline btn--sm">
            Search
          </button>
        </form>
        <select aria-label="Payment status" value={query.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value })}>
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select aria-label="Order status" value={query.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.orders.length === 0 ? (
        <EmptyState icon="receipt" title="No orders found" />
      ) : (
        <div className="table-wrap card card--flush">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Fulfilment</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="table__row-link" onClick={() => update({ open: o.id })}>
                  <td>
                    <button type="button" className="link-btn">
                      {o.orderNumber}
                    </button>
                    {o.needsReview && <span className="pill pill--deal">Review</span>}
                    {o.items.some((i) => i.returnedQuantity > 0) && o.status !== 'canceled' && <span className="pill pill--muted">Returns</span>}
                    <small className="muted block">{formatDateTime(o.createdAt)}</small>
                  </td>
                  <td>
                    {o.customer.firstName} {o.customer.lastName}
                    <small className="muted block">{o.customer.email}</small>
                  </td>
                  <td>{o.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</td>
                  <td>{formatMoney(o.total)}</td>
                  <td>
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <OrderDetail id={openId} onClose={() => update({ open: '' })} onUpdated={reload} />}
    </div>
  );
}
