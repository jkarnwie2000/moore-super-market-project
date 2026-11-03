import { formatMoney } from '../utils/format';

/** Totals table shared by cart, checkout and confirmation pages. */
export default function OrderSummary({ totals, deliveryMethod, promoCode, estimate = false, children }) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatMoney(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="totals__discount">
          <dt>Discount{promoCode ? ` (${promoCode})` : ''}</dt>
          <dd>−{formatMoney(totals.discount)}</dd>
        </div>
      )}
      <div>
        <dt>{deliveryMethod === 'pickup' ? 'Store pickup' : `Delivery${estimate ? ' (est.)' : ''}`}</dt>
        <dd>{totals.deliveryFee === 0 ? <span className="free">FREE</span> : formatMoney(totals.deliveryFee)}</dd>
      </div>
      <div>
        <dt>Tax{estimate ? ' (est.)' : ''}</dt>
        <dd>{formatMoney(totals.tax)}</dd>
      </div>
      <div className="totals__grand">
        <dt>Total</dt>
        <dd>{formatMoney(totals.total)}</dd>
      </div>
      {children}
    </dl>
  );
}
