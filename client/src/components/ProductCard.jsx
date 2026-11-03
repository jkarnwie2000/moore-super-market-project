import { Link } from 'react-router-dom';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { Rating } from './ui';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatMoney, percentOff } from '../utils/format';

export default function ProductCard({ product }) {
  const { add, quantityOf } = useCart();
  const { notify } = useToast();
  // Always show the cheapest size so the displayed price matches price sorting and filtering.
  const variant = [...product.variants].sort((a, b) => a.price - b.price)[0];
  // If a different size is discounted, flag it so weekly deals stay visible.
  const otherDeal = product.variants.find((v) => v._id !== variant._id && v.stock > 0 && percentOff(v.price, v.compareAtPrice) > 0);
  const inCart = quantityOf(product.id, variant._id);
  const soldOut = variant.stock <= 0;
  const atLimit = inCart >= variant.stock;
  const off = percentOff(variant.price, variant.compareAtPrice);
  const lowStock = variant.stock > 0 && variant.stock <= 5;

  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-card__media">
        <ProductImage src={product.image} alt={product.name} />
        <div className="product-card__badges">
          {off > 0 && <span className="pill pill--deal">-{off}%</span>}
          {!off && otherDeal && <span className="pill pill--deal">Deal on {otherDeal.label}</span>}
          {product.bestSeller && <span className="pill pill--best">Best seller</span>}
          {soldOut && <span className="pill pill--muted">Sold out</span>}
        </div>
      </Link>
      <div className="product-card__body">
        <p className="product-card__brand">
          {product.brand} · <span className={`region region--${product.region}`}>{product.region === 'african' ? 'African' : 'Caribbean'}</span>
        </p>
        <h3 className="product-card__title">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <Rating value={product.rating} count={product.numReviews} />
        <p className="product-card__size">
          {variant.label}
          {product.variants.length > 1 && <span> · {product.variants.length} sizes</span>}
          {lowStock && <span className="low-stock"> · Only {variant.stock} left</span>}
        </p>
        <div className="product-card__foot">
          <div className="price">
            <span className="price__now">{formatMoney(variant.price)}</span>
            {off > 0 && <s className="price__was">{formatMoney(variant.compareAtPrice)}</s>}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={soldOut || atLimit}
            aria-label={`Add ${product.name} to cart`}
            onClick={() => {
              add(product, variant, 1);
              notify(`Added ${product.name} (${variant.label}) to your cart`);
            }}
          >
            {soldOut ? 'Sold out' : atLimit ? 'Max in cart' : (
              <>
                <Icon name="plus" size={16} /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
