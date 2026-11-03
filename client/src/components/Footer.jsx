import { Link } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { useStore } from '../context/StoreContext';

export default function Footer() {
  const { african, caribbean } = useStore();
  return (
    <footer className="site-footer">
      <div className="kente-band" aria-hidden="true" />
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo inverted />
          <p>
            Your neighbourhood African &amp; Caribbean grocery — bringing the flavours of Lagos, Accra, Kingston and Port of Spain to your kitchen since day one.
          </p>
          <ul className="site-footer__contact">
            <li>
              <Icon name="pin" size={16} /> 1200 Market Street
            </li>
            <li>
              <Icon name="phone" size={16} /> (555) 010-2040
            </li>
            <li>
              <Icon name="clock" size={16} /> Mon–Sat 8am–9pm · Sun 10am–6pm
            </li>
          </ul>
        </div>
        <div>
          <h3>African Groceries</h3>
          <ul>
            {african.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link to={`/shop?category=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Caribbean Groceries</h3>
          <ul>
            {caribbean.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link to={`/shop?category=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Customer Care</h3>
          <ul>
            <li>
              <Link to="/account">My account</Link>
            </li>
            <li>
              <Link to="/account?tab=orders">Track an order</Link>
            </li>
            <li>
              <Link to="/shop?deals=1">Weekly deals</Link>
            </li>
            <li>
              <Link to="/cart">Shopping cart</Link>
            </li>
          </ul>
          <div className="site-footer__secure">
            <Icon name="shield" size={18} /> Secure payments by Stripe
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} Moore Supermarket. All rights reserved.</span>
          <span>Prices and availability subject to change.</span>
        </div>
      </div>
    </footer>
  );
}
