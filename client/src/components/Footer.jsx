import { Link } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { useStore } from '../context/StoreContext';
import { scrollToTop } from '../utils/scroll';
import BackToTop from './BackToTop';

/**
 * Footer links always take you to the top of the page — including links that only change
 * the shop filter (e.g. a category) or point at the page you're already on, where the
 * route-level scroll reset wouldn't fire. Ctrl/Cmd/Shift-click (new tab/window) is left alone.
 */
function FooterLink({ to, children }) {
  return (
    <Link
      to={to}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        scrollToTop();
      }}
    >
      {children}
    </Link>
  );
}

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
                <FooterLink to={`/shop?category=${c.slug}`}>{c.name}</FooterLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Caribbean Groceries</h3>
          <ul>
            {caribbean.slice(0, 6).map((c) => (
              <li key={c.id}>
                <FooterLink to={`/shop?category=${c.slug}`}>{c.name}</FooterLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Customer Care</h3>
          <ul>
            <li>
              <FooterLink to="/account">My account</FooterLink>
            </li>
            <li>
              <FooterLink to="/account?tab=orders">Track an order</FooterLink>
            </li>
            <li>
              <FooterLink to="/shop?deals=1">Weekly deals</FooterLink>
            </li>
            <li>
              <FooterLink to="/cart">Shopping cart</FooterLink>
            </li>
            <li>
              <FooterLink to="/admin">Admin Link</FooterLink>
            </li>
          </ul>
          <div className="site-footer__secure">
            <Icon name="shield" size={18} /> Secure payments by Stripe
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          <span className="site-footer__copy">© {new Date().getFullYear()} Moore Supermarket. All rights reserved.</span>
          <BackToTop />
          <span className="site-footer__note">Prices and availability subject to change.</span>
        </div>
      </div>
    </footer>
  );
}
