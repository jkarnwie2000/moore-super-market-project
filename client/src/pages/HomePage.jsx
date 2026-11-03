import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import ProductRail from '../components/ProductRail';
import Newsletter from '../components/Newsletter';
import { useStore } from '../context/StoreContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatMoney } from '../utils/format';

const HERO_ITEMS = [
  { slug: 'walkerswood-traditional-jerk-seasoning', alt: 'Jerk seasoning' },
  { slug: 'royal-stallion-parboiled-long-grain-rice', alt: 'Parboiled rice' },
  { slug: 'grace-ackee-in-brine', alt: 'Ackee' },
  { slug: 'red-palm-oil-zomi', alt: 'Red palm oil' },
];

function Hero() {
  return (
    <section className="hero">
      <div className="hero__pattern" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--gold">African &amp; Caribbean Grocery</p>
          <h1>
            Taste of home,
            <br />
            <em>delivered fresh.</em>
          </h1>
          <p className="hero__lead">
            From Nigerian ofada rice and red palm oil to Jamaican ackee and authentic jerk seasoning — shop over 60 pantry staples, fresh produce and
            snacks from across Africa and the Caribbean.
          </p>
          <div className="hero__ctas">
            <Link to="/shop" className="btn btn--gold btn--lg">
              Shop Now <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/shop?sort=popular" className="btn btn--ghost-light btn--lg">
              Explore Products
            </Link>
          </div>
          <ul className="hero__points">
            <li>
              <Icon name="truck" size={18} /> Same-week home delivery
            </li>
            <li>
              <Icon name="store" size={18} /> Free 2-hour store pickup
            </li>
            <li>
              <Icon name="shield" size={18} /> Secure checkout
            </li>
          </ul>
        </div>
        <div className="hero__art" aria-hidden="true">
          <div className="hero__circle" />
          {HERO_ITEMS.map((item, i) => (
            <img key={item.slug} className={`hero__item hero__item--${i + 1}`} src={`/images/products/${item.slug}.svg`} alt="" />
          ))}
          <div className="hero__sticker">
            <strong>10% off</strong>
            <span>your first order</span>
            <code>WELCOME10</code>
          </div>
        </div>
      </div>
    </section>
  );
}

function RegionCards() {
  return (
    <section className="section section--tight">
      <div className="container region-cards">
        <Link to="/shop?region=african" className="region-card region-card--african">
          <div>
            <p className="eyebrow">From Lagos to Accra</p>
            <h2>African Groceries</h2>
            <p>Rice &amp; grains, garri, yam flour, palm oil, egusi, suya spice and more.</p>
            <span className="btn btn--light">
              Shop African Groceries <Icon name="arrowRight" size={16} />
            </span>
          </div>
          <img src="/images/products/ijebu-white-garri.svg" alt="" aria-hidden="true" />
        </Link>
        <Link to="/shop?region=caribbean" className="region-card region-card--caribbean">
          <div>
            <p className="eyebrow">From Kingston to Port of Spain</p>
            <h2>Caribbean Groceries</h2>
            <p>Ackee, jerk seasoning, coconut milk, hard dough bread, Ting and more.</p>
            <span className="btn btn--light">
              Shop Caribbean Groceries <Icon name="arrowRight" size={16} />
            </span>
          </div>
          <img src="/images/products/coconut-milk-full-fat.svg" alt="" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function CategoryChips() {
  const { categories } = useStore();
  if (!categories.length) return null;
  return (
    <section className="section section--tight">
      <div className="container">
        <div className="section-header">
          <div>
            <p className="eyebrow">Browse the aisles</p>
            <h2>Shop by category</h2>
          </div>
        </div>
        <div className="chip-scroller">
          {categories.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className={`cat-chip cat-chip--${c.region}`}>
              <span>{c.name}</span>
              <small>{c.productCount} items</small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PromoBanners() {
  const { config } = useStore();
  return (
    <section className="section section--tight">
      <div className="container promo-grid">
        <div className="promo promo--orange">
          <p className="eyebrow">This week only</p>
          <h3>$5 off orders over $40</h3>
          <p>
            Use code <code>JERK5</code> at checkout — perfect for stocking up on jerk, curry and all-purpose seasonings.
          </p>
          <Link to="/shop?category=caribbean-spices-and-seasonings" className="btn btn--light btn--sm">
            Shop seasonings
          </Link>
        </div>
        <div className="promo promo--green">
          <p className="eyebrow eyebrow--gold">Big-shop savings</p>
          <h3>15% off orders over $100</h3>
          <p>
            Code <code>HARVEST15</code>. Plus free home delivery on every order over {formatMoney(config.freeDeliveryThreshold)}.
          </p>
          <Link to="/shop?category=rice-and-grains" className="btn btn--gold btn--sm">
            Stock the pantry
          </Link>
        </div>
        <div className="promo promo--cream">
          <p className="eyebrow">Fresh every week</p>
          <h3>Yam, plantain &amp; mangoes</h3>
          <p>Hand-picked produce delivered to our shelves every Tuesday and Friday.</p>
          <Link to="/shop?category=yam-and-plantain" className="btn btn--primary btn--sm">
            Shop fresh
          </Link>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    ['leaf', 'Authentic brands', 'Sourced from trusted producers across Africa & the Caribbean'],
    ['truck', 'Fast delivery', 'Home delivery or free same-day store pickup'],
    ['tag', 'Weekly deals', 'Fresh savings on your favourites every week'],
    ['shield', 'Secure checkout', 'Payments processed safely by Stripe'],
  ];
  return (
    <section className="trust">
      <div className="container trust__grid">
        {items.map(([icon, title, text]) => (
          <div key={title} className="trust__item">
            <span className="trust__icon">
              <Icon name={icon} size={22} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle('');
  return (
    <>
      <Hero />
      <TrustStrip />
      <RegionCards />
      <ProductRail eyebrow="Hand-picked for you" title="Featured groceries" params={{ featured: 1, sort: 'popular' }} to="/shop?featured=1" limit={8} />
      <section className="deals-band">
        <ProductRail eyebrow="Save this week" title="Weekly grocery deals" params={{ deals: 1, sort: 'popular' }} to="/shop?deals=1" limit={4} />
        <div className="container deals-band__cta">
          <Link to="/shop?deals=1" className="btn btn--orange">
            View Deals <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>
      <CategoryChips />
      <ProductRail eyebrow="Customer favourites" title="Popular African products" params={{ region: 'african', sort: 'popular' }} to="/shop?region=african" />
      <PromoBanners />
      <ProductRail eyebrow="Island flavours" title="Popular Caribbean products" params={{ region: 'caribbean', sort: 'popular' }} to="/shop?region=caribbean" />
      <ProductRail eyebrow="Top of the charts" title="Best-selling products" params={{ bestSeller: 1, sort: 'popular' }} to="/shop?bestSeller=1" limit={8} />
      <Newsletter />
    </>
  );
}
