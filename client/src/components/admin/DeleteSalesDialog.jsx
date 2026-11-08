import { useState } from 'react';
import Modal from './Modal';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatMoney } from '../../utils/format';

/**
 * Confirms and performs permanent deletion of one or more orders ("sales").
 * `orders` are order objects from the admin API; `onDeleted(result)` runs after success.
 */
export default function DeleteSalesDialog({ orders, onClose, onDeleted }) {
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useToast();

  const paid = orders.filter((o) => o.paymentStatus === 'paid');
  const withStock = orders.filter((o) => o.inventoryAdjusted);
  const units = withStock.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);
  const value = paid.reduce((n, o) => n + o.total, 0);
  const single = orders.length === 1;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = single
        ? await api.del(`/admin/orders/${orders[0].id}?restock=${restock ? 1 : 0}`)
        : await api.post('/admin/orders/delete', { ids: orders.map((o) => o.id), restock });
      const parts = [`Deleted ${result.deleted.length} ${result.deleted.length === 1 ? 'sale' : 'sales'}`];
      if (result.unitsReturned) parts.push(`${result.unitsReturned} units returned to stock`);
      notify(parts.join(' · '));
      if (result.failed.length) {
        notify(`${result.failed.length} could not be deleted: ${result.failed.map((f) => `${f.orderNumber} — ${f.message}`).join('; ')}`, { type: 'error' });
      }
      onDeleted(result);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={single ? `Delete ${orders[0].orderNumber}?` : `Delete ${orders.length} sales?`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Keep {single ? 'it' : 'them'}
          </button>
          <button type="button" className="btn btn--danger" onClick={confirm} disabled={busy}>
            {busy ? 'Deleting…' : single ? 'Delete sale' : `Delete ${orders.length} sales`}
          </button>
        </>
      }
    >
      <div className="stack stack--tight">
        <p>
          This permanently removes {single ? 'this order' : 'these orders'} from your records and sales reports. It can't be undone.
        </p>
        {paid.length > 0 && (
          <div className="alert alert--warning">
            <span>
              <strong>
                {paid.length} paid {paid.length === 1 ? 'order' : 'orders'} ({formatMoney(value)}).
              </strong>{' '}
              Deleting does not refund the customer. To give money back, refund the payment in your Stripe dashboard first.
            </span>
          </div>
        )}
        {units > 0 && (
          <label className="checkbox">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Return {units} {units === 1 ? 'unit' : 'units'} to stock
          </label>
        )}
        {paid.length < orders.length && (
          <p className="muted small">Unpaid orders still open in Stripe Checkout are closed first, so they can't be paid after deletion.</p>
        )}
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
