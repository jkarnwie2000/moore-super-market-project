import { useState } from 'react';
import Modal from './Modal';
import { Field } from '../ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const MODES = {
  add: { label: 'Add stock', verb: 'Add', reasons: [['restock', 'Restock / delivery received'], ['returned', 'Customer return'], ['adjustment', 'Count correction']] },
  remove: { label: 'Remove stock', verb: 'Remove', reasons: [['damaged', 'Damaged / expired'], ['adjustment', 'Count correction']] },
  set: { label: 'Set exact count', verb: 'Set', reasons: [['adjustment', 'Stock count'], ['restock', 'Restock']] },
};

/** Add, remove or set the stock of one product size, with a reason and note for the history. */
export default function AdjustStockDialog({ row, initialMode = 'add', onClose, onSaved }) {
  const [mode, setMode] = useState(initialMode);
  const [quantity, setQuantity] = useState(initialMode === 'set' ? String(row.stock) : '');
  const [reason, setReason] = useState(MODES[initialMode].reasons[0][0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();

  const qty = Number(quantity);
  const valid = quantity !== '' && Number.isInteger(qty) && qty >= (mode === 'set' ? 0 : 1) && (mode !== 'remove' || qty <= row.stock);
  const after = !valid ? null : mode === 'add' ? row.stock + qty : mode === 'remove' ? row.stock - qty : qty;

  function switchMode(m) {
    setMode(m);
    setReason(MODES[m].reasons[0][0]);
    setQuantity(m === 'set' ? String(row.stock) : '');
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/admin/inventory/adjust', { productId: row.productId, variantId: row.variantId, mode, quantity: qty, reason, note });
      notify(res.unchanged ? 'Stock unchanged' : `${row.name} (${row.label}): stock is now ${res.stock}`);
      onSaved(res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Update stock — ${row.name}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="adjust-stock-form" className="btn btn--primary" disabled={!valid || busy}>
            {busy ? 'Saving…' : `${MODES[mode].verb} stock`}
          </button>
        </>
      }
    >
      <form id="adjust-stock-form" className="stack stack--tight" onSubmit={submit}>
        <p className="muted small">
          Size <strong>{row.label}</strong> · currently <strong>{row.stock}</strong> in stock
        </p>
        <div className="seg" role="group" aria-label="Type of change">
          {Object.entries(MODES).map(([key, m]) => (
            <button key={key} type="button" className={`chip ${mode === key ? 'chip--active' : ''}`} aria-pressed={mode === key} onClick={() => switchMode(key)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field
            label={mode === 'set' ? 'New stock count' : mode === 'add' ? 'Units to add' : 'Units to remove'}
            error={quantity !== '' && !valid ? (mode === 'remove' && qty > row.stock ? `Only ${row.stock} in stock.` : 'Enter a whole number.') : ''}
          >
            <input type="number" inputMode="numeric" min={mode === 'set' ? 0 : 1} max={mode === 'remove' ? row.stock : 100000} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {MODES[mode].reasons.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Note (optional)" hint="For example a supplier invoice number.">
          <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {after !== null && (
          <p className="stock-preview" aria-live="polite">
            {row.stock} → <strong>{after}</strong> in stock
          </p>
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
