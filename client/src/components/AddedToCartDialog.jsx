import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Modal from './admin/Modal';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { formatMoney } from '../utils/format';

/**
 * Shown after adding a product: lets the shopper keep browsing or go straight to checkout.
 * Rendered once in App; opened by cart.addAndConfirm().
 */
export default function AddedToCartDialog() {
  const { items, count, justAdded, dismissAdded } = useCart();
  const { config } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const openedOn = useRef(pathname);

  // Close it if the shopper navigates away by some other route (header link, back button…).
  useEffect(() => {
    if (justAdded) openedOn.current = pathname;
  }, [justAdded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (justAdded && pathname !== openedOn.current) dismissAdded();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!justAdded) return null;
  const line = items.find((i) => i.productId === justAdded.productId && i.variantId === justAdded.variantId);
  if (!line) return null;

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const toFree = Math.max(0, config.freeDeliveryThreshold - subtotal);
  const go = (to) => {
    dismissAdded();
    navigate(to);
  };

  return (
    <Modal
      title="Added to your cart"
      onClose={dismissAdded}
      footer={
        <>
          <button type="button" className="btn btn--outline" onClick={dismissAdded}>
            Continue shopping
          </button>
          <button type="button" className="btn btn--primary" onClick={() => go('/checkout')}>
            Proceed to checkout <Icon name="arrowRight" size={18} />
          </button>
        </>
      }
    >
      <div className="added">
        <div className="added__item">
          <ProductImage src={line.image} alt="" />
          <div>
            <p className="added__check">
              <Icon name="check" size={16} strokeWidth={2.6} /> {justAdded.quantity} × added
            </p>
            <strong>{line.name}</strong>
            <span className="muted block small">
              {line.size} · {formatMoney(line.price)} each
            </span>
            {line.quantity > justAdded.quantity && <span className="muted block small">{line.quantity} of this item in your cart now</span>}
          </div>
        </div>
        <div className="added__summary">
          <span>
            Cart: <strong>{count}</strong> {count === 1 ? 'item' : 'items'}
          </span>
          <span>
            Subtotal <strong>{formatMoney(subtotal)}</strong>
          </span>
        </div>
        <p className={`added__delivery ${toFree === 0 ? 'is-free' : ''}`}>
          <Icon name="truck" size={16} />
          {toFree === 0 ? 'Your order qualifies for free home delivery.' : `Add ${formatMoney(toFree)} more for free home delivery.`}
        </p>
        <Link to="/cart" className="link-arrow added__cart" onClick={dismissAdded}>
          View or edit cart →
        </Link>
      </div>
    </Modal>
  );
}
