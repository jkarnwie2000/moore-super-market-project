import Modal from './Modal';
import { formatDateTime, formatMoney } from '../../utils/format';

export const PAYMENT_LABELS = { cash: 'Cash', card: 'Card', mobile_money: 'Mobile money', other: 'Other', stripe: 'Online (Stripe)' };

/** Printable till receipt for an in-store sale. */
export default function Receipt({ order, onClose, onNewSale }) {
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Modal
      title={onNewSale ? 'Sale complete' : `Receipt ${order.orderNumber}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={() => window.print()}>
            Print receipt
          </button>
          {onNewSale && (
            <button type="button" className="btn btn--primary" onClick={onNewSale}>
              New sale
            </button>
          )}
        </>
      }
    >
      <div className="receipt" aria-label="Receipt">
        <div className="receipt__head">
          <strong>Moore Supermarket</strong>
          <span>African &amp; Caribbean Groceries</span>
          <span>{formatDateTime(order.paidAt || order.createdAt)}</span>
          <span>Receipt {order.orderNumber}</span>
        </div>
        <table className="receipt__items">
          <tbody>
            {order.items.map((i) => (
              <tr key={i.variantId}>
                <td>
                  {i.name} <span className="muted">({i.size})</span>
                  <br />
                  <span className="muted">
                    {i.quantity} × {formatMoney(i.unitPrice)}
                  </span>
                </td>
                <td>{formatMoney(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="receipt__totals">
          <div>
            <dt>Subtotal ({units} {units === 1 ? 'item' : 'items'})</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div>
              <dt>Discount {order.promoCode && `(${order.promoCode})`}</dt>
              <dd>−{formatMoney(order.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Tax</dt>
            <dd>{formatMoney(order.tax)}</dd>
          </div>
          <div className="receipt__total">
            <dt>Total</dt>
            <dd>{formatMoney(order.total)}</dd>
          </div>
          <div>
            <dt>Paid by {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</dt>
            <dd>{formatMoney(order.amountTendered ?? order.total)}</dd>
          </div>
          {order.changeGiven > 0 && (
            <div className="receipt__change">
              <dt>Change</dt>
              <dd>{formatMoney(order.changeGiven)}</dd>
            </div>
          )}
        </dl>
        <p className="receipt__foot">
          {order.soldBy && <>Served by {order.soldBy} · </>}Keep this receipt for returns. Thank you!
        </p>
      </div>
    </Modal>
  );
}
