import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import { EmptyState, ErrorState, PageLoader, QuantitySelector, Rating } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatMoney, percentOff } from '../utils/format';

export default function ProductPage() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useApi(`/products/${encodeURIComponent(slug)}`);
  const { add, quantityOf } = useCart();
  const { notify } = useToast();
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);

  const product = data?.product;
  useDocumentTitle(product?.name || 'Product');

  useEffect(() => {
    if (product) {
      const firstAvailable = product.variants.find((v) => v.stock > 0) || product.variants[0];
      setVariantId(firstAvailable._id);
      setQty(1);
    }
  }, [product]);

  if (loading) return <PageLoader />;
  if (error?.status === 404) {
    return (
      <div className="container">
        <EmptyState
          icon="search"
          title="Product not found"
          action={
            <Link to="/shop" className="btn btn--primary">
              Continue shopping
            </Link>
          }
        >
          This product may have been removed or is no longer available.
        </EmptyState>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const variant = product.variants.find((v) => v._id === variantId) || product.variants[0];
  const inCart = quantityOf(product.id, variant._id);
  const remaining = Math.max(0, variant.stock - inCart);
  const off = percentOff(variant.price, variant.compareAtPrice);
  const regionLabel = product.region === 'african' ? 'African Groceries' : 'Caribbean Groceries';

  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <Icon name="chevronRight" size={14} />
        <Link to={`/shop?region=${product.region}`}>{regionLabel}</Link> <Icon name="chevronRight" size={14} />
        <Link to={`/shop?category=${product.category.slug}`}>{product.category.name}</Link>
      </nav>

      <div className="product-detail">
        <div className="product-detail__media">
          <ProductImage src={product.image} alt={product.name} eager />
          {off > 0 && <span className="pill pill--deal pill--lg">Save {off}%</span>}
        </div>

        <div className="product-detail__info">
          <p className="product-detail__brand">
            {product.brand}
            {product.origin && <span> · Product of {product.origin}</span>}
          </p>
          <h1>{product.name}</h1>
          <Rating value={product.rating} count={product.numReviews} />

          <div className="price price--lg">
            <span className="price__now">{formatMoney(variant.price)}</span>
            {off > 0 && <s className="price__was">{formatMoney(variant.compareAtPrice)}</s>}
            <span className="price__unit">/ {variant.label}</span>
          </div>

          <p className="product-detail__desc">{product.description}</p>

          <fieldset className="variant-picker">
            <legend>Size / package weight</legend>
            <div className="variant-picker__options">
              {product.variants.map((v) => (
                <label key={v._id} className={`variant ${v._id === variant._id ? 'is-selected' : ''} ${v.stock === 0 ? 'is-soldout' : ''}`}>
                  <input
                    type="radio"
                    name="variant"
                    value={v._id}
                    checked={v._id === variant._id}
                    onChange={() => {
                      setVariantId(v._id);
                      setQty(1);
                    }}
                  />
                  <strong>{v.label}</strong>
                  <span>{v.stock === 0 ? 'Sold out' : formatMoney(v.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className={`stock ${variant.stock === 0 ? 'stock--out' : variant.stock <= 5 ? 'stock--low' : 'stock--in'}`}>
            <span className="stock__dot" />
            {variant.stock === 0 ? 'Out of stock' : variant.stock <= 5 ? `Only ${variant.stock} left in stock` : `In stock (${variant.stock} available)`}
            {inCart > 0 && <span className="muted"> · {inCart} in your cart</span>}
          </p>

          <div className="buy-box">
            <QuantitySelector value={Math.min(qty, Math.max(remaining, 1))} max={Math.max(remaining, 1)} onChange={setQty} />
            <button
              type="button"
              className="btn btn--primary btn--lg btn--grow"
              disabled={remaining === 0}
              onClick={() => {
                const q = Math.min(qty, remaining);
                add(product, variant, q);
                notify(`Added ${q} × ${product.name} (${variant.label}) to your cart`, {
                  action: (
                    <Link to="/cart" className="toast__action">
                      View cart
                    </Link>
                  ),
                });
                setQty(1);
              }}
            >
              <Icon name="cart" size={20} />
              {variant.stock === 0 ? 'Out of stock' : remaining === 0 ? 'All available stock is in your cart' : `Add to Cart · ${formatMoney(variant.price * Math.min(qty, remaining))}`}
            </button>
          </div>

          <ul className="product-detail__perks">
            <li>
              <Icon name="truck" size={18} /> Home delivery or free store pickup
            </li>
            <li>
              <Icon name="leaf" size={18} /> Authentic {product.region === 'african' ? 'African' : 'Caribbean'} product
            </li>
            <li>
              <Icon name="shield" size={18} /> Secure checkout with Stripe
            </li>
          </ul>
        </div>
      </div>

      {data.related.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <p className="eyebrow">You may also like</p>
              <h2>Related products</h2>
            </div>
          </div>
          <div className="product-grid">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
