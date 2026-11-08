import { useState } from 'react';
import Modal from './Modal';
import { Field, QuantitySelector } from '../ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatMoney } from '../../utils/format';

export const RETURN_REASONS = {
  customer_return: 'Customer returned it',
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item sent',
  expired: 'Expired / quality issue',
  other: 'Other',
};

const remaining = (i) => i.quantity - (i.returnedQuantity || 0);

/** Record items coming back from an order. Restocked items go straight back into inventory. */
export default function ReturnDialog({ order, onClose, onSaved }) {
  const returnable = order.items.filter((i) => remaining(i) > 0);
  const [lines, setLines] = useState(() => Object.fromEntries(returnable.map((i) => [i.variantId, { quantity: 0, restock: true }])));
  const [reason, setReason] = useState('customer_return');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useToast();

  const set = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));
  const chosen = returnable.filter((i) => lines[i.variantId].quantity > 0);
  const units = chosen.reduce((s, i) => s + lines[i.variantId].quantity, 0);
  const restockUnits = chosen.filter((i) => lines[i.variantId].restock).reduce((s, i) => s + lines[i.variantId].quantity, 0);
  const value = chosen.reduce((s, i) => s + lines[i.variantId].quantity * i.unitPrice, 0);

  function pickReason(r) {
    setReason(r);
    // Damaged or expired goods usually can't be sold again.
    if (r === 'damaged' || r === 'expired') setLines((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, restock: false }])));
  }

  async function submit(e) {
    e.preventDefault();
    if (!units) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/admin/orders/${order.id}/returns`, {
        items: chosen.map((i) => ({ variantId: i.variantId, quantity: lines[i.variantId].quantity, restock: lines[i.variantId].restock })),
        reason,
        note,
      });
      const parts = [`Return recorded: ${res.unitsReturned} ${res.unitsReturned === 1 ? 'item' : 'items'}`];
      parts.push(res.unitsRestocked ? `${res.unitsRestocked} back in stock` : 'none restocked');
      notify(parts.join(' · '));
      if (res.skipped.length) notify(`Not restocked (product no longer exists): ${res.skipped.join(', ')}`, { type: 'error' });
      onSaved(res.order);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Record a return — ${order.orderNumber}`}
      size="lg"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="return-form" className="btn btn--primary" disabled={!units || busy}>
            {busy ? 'Saving…' : units ? `Record return of ${units}` : 'Record return'}
          </button>
        </>
      }
    >
      <form id="return-form" className="stack stack--tight" onSubmit={submit}>
        <p className="muted small">Choose how many of each item came back. Ticked items go straight back into stock; untick anything that can't be sold again.</p>
        <div className="table-wrap">
          <table className="table table--compact return-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Returning</th>
                <th>Back in stock?</th>
              </tr>
            </thead>
            <tbody>
              {returnable.map((i) => {
                const l = lines[i.variantId];
                return (
                  <tr key={i.variantId}>
                    <td>
                      {i.name}
                      <small className="muted block">
                        {i.size} · {formatMoney(i.unitPrice)} each · {remaining(i)} of {i.quantity} can be returned
                      </small>
                    </td>
                    <td>
                      <QuantitySelector
                        size="sm"
                        min={0}
                        max={remaining(i)}
                        value={l.quantity}
                        label={`How many ${i.name} (${i.size}) came back`}
                        onChange={(q) => set(i.variantId, { quantity: q })}
                      />
                      {remaining(i) > 1 && l.quantity < remaining(i) && (
                        <button type="button" className="link-btn small" onClick={() => set(i.variantId, { quantity: remaining(i) })}>
                          All {remaining(i)}
                        </button>
                      )}
                    </td>
                    <td>
                      <label className="checkbox">
                        <input type="checkbox" checked={l.restock} onChange={(e) => set(i.variantId, { restock: e.target.checked })} /> Restock
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="form-grid">
          <Field label="Reason">
            <select value={reason} onChange={(e) => pickReason(e.target.value)}>
              {Object.entries(RETURN_REASONS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note (optional)">
            <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {units > 0 && (
          <p className="stock-preview" aria-live="polite">
            {units} {units === 1 ? 'item' : 'items'} worth {formatMoney(value)} · <strong>{restockUnits}</strong> back into stock
            {units - restockUnits > 0 && `, ${units - restockUnits} written off`}
          </p>
        )}
        {order.paymentStatus === 'paid' && (
          <p className="muted small">Recording a return doesn't refund the customer. If they're owed money, refund it in your Stripe dashboard.</p>
        )}
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
