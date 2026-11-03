import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import OrderSummary from '../components/OrderSummary';
import ProductImage from '../components/ProductImage';
import { EmptyState, PageLoader, StatusBadge } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { formatDateTime, formatMoney } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const MAX_POLLS = 10;

export default function OrderConfirmationPage() {
  useDocumentTitle('Order confirmation');
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const { clear } = useCart();
  const { config } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [polls, setPolls] = useState(0);
  const cleared = useRef(false);

  // Order details come from our backend, which verifies payment with Stripe —
  // the session_id in the URL is only used as a lookup key.
  useEffect(() => {
    if (!sessionId) return undefined;
    let timer;
    let cancelled = false;
    api
      .get(`/checkout/session/${encodeURIComponent(sessionId)}`)
      .then(({ order: o }) => {
        if (cancelled) return;
        setOrder(o);
        if (o.paymentStatus === 'unpaid' && polls < MAX_POLLS) timer = setTimeout(() => setPolls((n) => n + 1), 2000);
      })
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, polls]);

  useEffect(() => {
    if (order?.paymentStatus === 'paid' && !cleared.current) {
      cleared.current = true;
      clear();
      try {
        sessionStorage.removeItem('moore_checkout_draft');
      } catch {
        /* ignore */
      }
    }
  }, [order, clear]);

  if (!sessionId || error) {
    return (
      <div className="container">
        <EmptyState
          icon="receipt"
          title="We couldn’t find that order"
          action={
            <Link to="/shop" className="btn btn--primary">
              Continue shopping
            </Link>
          }
        >
          {error?.message || 'This confirmation link is missing its order reference.'}
        </EmptyState>
      </div>
    );
  }

  if (!order) return <PageLoader label="Loading your order…" />;

  if (order.paymentStatus === 'unpaid') {
    return (
      <div className="container confirm">
        <div className="confirm__hero confirm__hero--pending">
          <div className="spinner__ring" aria-hidden="true" />
          <h1>Confirming your payment…</h1>
          <p>
            Order <strong>{order.orderNumber}</strong> — this usually takes just a few seconds.
            {polls >= MAX_POLLS && ' It’s taking longer than usual; you’ll receive an email once payment is confirmed.'}
          </p>
          {polls >= MAX_POLLS && (
            <button type="button" className="btn btn--outline" onClick={() => setPolls(0)}>
              Check again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (order.paymentStatus !== 'paid') {
    return (
      <div className="container">
        <EmptyState
          icon="receipt"
          title="Payment not completed"
          action={
            <Link to="/checkout" className="btn btn--primary">
              Return to checkout
            </Link>
          }
        >
          Order {order.orderNumber} was {order.paymentStatus}. You have not been charged.
        </EmptyState>
      </div>
    );
  }

  const c = order.customer;
  return (
    <div className="container confirm">
      <div className="confirm__hero">
        <span className="confirm__check">
          <Icon name="check" size={36} strokeWidth={2.5} />
        </span>
        <p className="eyebrow">Order confirmed</p>
        <h1>Thank you for shopping with Moore Supermarket! Your order has been successfully placed.</h1>
        <p>
          A confirmation has been sent to <strong>{c.email}</strong>.
        </p>
        <div className="confirm__number">
          Order number <strong data-testid="order-number">{order.orderNumber}</strong>
        </div>
      </div>

      <div className="confirm__grid">
        <section className="card">
          <h2>Items purchased</h2>
          <ul className="mini-items">
            {order.items.map((i) => (
              <li key={`${i.product}-${i.size}`}>
                <span className="mini-items__img">
                  <ProductImage src={i.image} alt="" />
                  <span className="mini-items__qty">{i.quantity}</span>
                </span>
                <span className="mini-items__name">
                  {i.name}
                  <small>
                    {i.size} · {formatMoney(i.unitPrice)} × {i.quantity}
                  </small>
                </span>
                <strong>{formatMoney(i.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          <OrderSummary totals={order} deliveryMethod={order.deliveryMethod} promoCode={order.promoCode} />
        </section>

        <section className="card confirm__details">
          <h2>Order details</h2>
          <dl className="details">
            <div>
              <dt>Payment status</dt>
              <dd>
                <StatusBadge status={order.paymentStatus} />
              </dd>
            </div>
            <div>
              <dt>Amount paid</dt>
              <dd>
                <strong>{formatMoney(order.amountPaid || order.total)}</strong>
              </dd>
            </div>
            <div>
              <dt>Order status</dt>
              <dd>
                <StatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt>Placed</dt>
              <dd>{formatDateTime(order.paidAt || order.createdAt)}</dd>
            </div>
          </dl>

          <h3>Customer</h3>
          <p>
            {c.firstName} {c.lastName}
            <br />
            {c.email}
            <br />
            {c.phone}
          </p>

          <h3>{order.deliveryMethod === 'pickup' ? 'Store pickup' : 'Home delivery'}</h3>
          {order.deliveryMethod === 'pickup' ? (
            <p>
              Collect from {config.storeAddress || 'Moore Supermarket'}. We’ll notify you when your order is ready (usually within 2 hours during opening
              hours).
            </p>
          ) : (
            <p>
              {c.street}
              <br />
              {c.city}, {c.state} {c.zip}
              <br />
              {c.country}
            </p>
          )}
          <div className="confirm__actions">
            <Link to="/shop" className="btn btn--primary">
              Continue shopping
            </Link>
            <Link to="/account?tab=orders" className="btn btn--outline">
              View my orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
