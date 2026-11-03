import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import OrderSummary from '../components/OrderSummary';
import ProductImage from '../components/ProductImage';
import { EmptyState, QuantitySelector } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { estimateTotals } from '../utils/pricing';
import { formatMoney } from '../utils/format';

export default function CartPage() {
  const { items, count, setQuantity, remove, clear, syncNotice, dismissSyncNotice } = useCart();
  const { config } = useStore();
  useDocumentTitle('Your cart');
  const totals = estimateTotals(items, { deliveryMethod: 'delivery', config });

  if (!items.length) {
    return (
      <div className="container">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          action={
            <Link to="/shop" className="btn btn--primary btn--lg">
              Start shopping
            </Link>
          }
        >
          Looks like you haven’t added anything yet. Explore our African and Caribbean groceries.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <h1>
        Shopping cart <span className="muted">({count} item{count === 1 ? '' : 's'})</span>
      </h1>

      {syncNotice && (
        <div className="alert alert--info" role="status">
          {syncNotice}
          <button type="button" className="link-btn" onClick={dismissSyncNotice}>
            Dismiss
          </button>
        </div>
      )}

      <div className="cart-layout">
        <section aria-label="Cart items">
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.key} className="cart-item">
                <Link to={`/product/${item.slug}`} className="cart-item__img">
                  <ProductImage src={item.image} alt={item.name} />
                </Link>
                <div className="cart-item__info">
                  <p className="cart-item__brand">{item.brand}</p>
                  <Link to={`/product/${item.slug}`} className="cart-item__name">
                    {item.name}
                  </Link>
                  <p className="muted">
                    {item.size} · {formatMoney(item.price)} each
                  </p>
                  {item.quantity >= item.stock && <p className="low-stock">Maximum available quantity ({item.stock}) reached</p>}
                </div>
                <div className="cart-item__qty">
                  <QuantitySelector value={item.quantity} max={item.stock} min={1} size="sm" label={`Quantity for ${item.name}`} onChange={(q) => setQuantity(item.key, q)} />
                  <button type="button" className="link-btn link-btn--danger" onClick={() => remove(item.key)}>
                    <Icon name="trash" size={15} /> Remove
                  </button>
                </div>
                <div className="cart-item__total" data-testid="line-total">
                  {formatMoney(item.price * item.quantity)}
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-actions">
            <Link to="/shop" className="link-arrow">
              ← Continue shopping
            </Link>
            <button type="button" className="link-btn link-btn--danger" onClick={clear}>
              Empty cart
            </button>
          </div>
        </section>

        <aside className="summary-card" aria-label="Order summary">
          <h2>Order summary</h2>
          {totals.amountToFreeDelivery > 0 ? (
            <div className="free-delivery">
              <p>
                Add <strong>{formatMoney(totals.amountToFreeDelivery)}</strong> more for FREE delivery
              </p>
              <div className="progress">
                <span style={{ width: `${Math.min(100, (totals.subtotal / config.freeDeliveryThreshold) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="free-delivery free-delivery--done">
              <Icon name="check" size={16} /> You’ve unlocked FREE home delivery
            </p>
          )}
          <OrderSummary totals={totals} deliveryMethod="delivery" estimate />
          <p className="muted small">Choose store pickup at checkout for free collection. Discount codes are applied at checkout.</p>
          <Link to="/checkout" className="btn btn--primary btn--lg btn--block">
            Proceed to checkout
          </Link>
          <p className="secure-note">
            <Icon name="shield" size={16} /> Secure checkout powered by Stripe
          </p>
        </aside>
      </div>
    </div>
  );
}
