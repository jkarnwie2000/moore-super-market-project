import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatMoney } from '../utils/format';

function SearchBar({ onSubmitted, autoFocus }) {
  const [params] = useSearchParams();
  const [value, setValue] = useState(params.get('q') || '');
  const navigate = useNavigate();
  useEffect(() => {
    setValue(params.get('q') || '');
  }, [params]);
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
        onSubmitted?.();
      }}
    >
      <Icon name="search" size={18} className="search__icon" />
      <input
        type="search"
        aria-label="Search products"
        placeholder="Search rice, egusi, jerk seasoning, ackee…"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn btn--gold btn--sm">
        Search
      </button>
    </form>
  );
}

function MegaMenu({ title, region, categories, open, onToggle, onClose }) {
  return (
    <div className={`nav-dropdown ${open ? 'is-open' : ''}`} onMouseLeave={onClose}>
      <button type="button" className="nav-link nav-dropdown__toggle" aria-expanded={open} onClick={onToggle} onMouseEnter={onToggle}>
        {title} <Icon name="chevronDown" size={14} />
      </button>
      <div className="nav-dropdown__panel">
        <div className="nav-dropdown__grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} onClick={onClose}>
              {c.name}
            </Link>
          ))}
        </div>
        <Link className="nav-dropdown__all" to={`/shop?region=${region}`} onClick={onClose}>
          Shop all {title} <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

export default function Header() {
  const { count } = useCart();
  const { user, isAdmin, logout } = useAuth();
  const { african, caribbean, config } = useStore();
  const [menu, setMenu] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const accountRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setMenu(null);
    setDrawer(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onDoc = (e) => accountRef.current && !accountRef.current.contains(e.target) && setAccountOpen(false);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
  }, [drawer]);

  return (
    <header className="site-header">
      <div className="promo-bar">
        <div className="container promo-bar__inner">
          <span>
            <Icon name="truck" size={16} /> Free home delivery on orders over {formatMoney(config.freeDeliveryThreshold)}
          </span>
          <span className="hide-sm">
            <Icon name="store" size={16} /> Free store pickup — ready in 2 hours
          </span>
          <span className="hide-md">
            <Icon name="leaf" size={16} /> Fresh yam, plantain & scotch bonnets every week
          </span>
        </div>
      </div>

      <div className="header-main">
        <div className="container header-main__inner">
          <button type="button" className="icon-btn show-md" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <Logo />
          <div className="header-search hide-md">
            <SearchBar />
          </div>
          <div className="header-actions">
            {isAdmin && (
              <Link to="/admin" className="header-action header-action--admin">
                <Icon name="grid" />
                <span className="header-action__label hide-sm">
                  <small>Store</small>
                  <strong>Admin</strong>
                </span>
              </Link>
            )}
            <div className="account-menu" ref={accountRef}>
              {user ? (
                <>
                  <button type="button" className="header-action" aria-expanded={accountOpen} onClick={() => setAccountOpen((o) => !o)}>
                    <Icon name="user" />
                    <span className="header-action__label hide-sm">
                      <small>Hello, {user.name.split(' ')[0]}</small>
                      <strong>Account</strong>
                    </span>
                  </button>
                  {accountOpen && (
                    <div className="account-menu__panel" role="menu">
                      <Link to="/account" role="menuitem">
                        <Icon name="user" size={16} /> My profile
                      </Link>
                      <Link to="/account?tab=orders" role="menuitem">
                        <Icon name="receipt" size={16} /> My orders
                      </Link>
                      <Link to="/account?tab=addresses" role="menuitem">
                        <Icon name="pin" size={16} /> Saved addresses
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" role="menuitem">
                          <Icon name="grid" size={16} /> Admin dashboard
                        </Link>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          await logout();
                          navigate('/');
                        }}
                      >
                        <Icon name="logout" size={16} /> Sign out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link to="/login" className="header-action">
                  <Icon name="user" />
                  <span className="header-action__label hide-sm">
                    <small>Welcome</small>
                    <strong>Sign in</strong>
                  </span>
                </Link>
              )}
            </div>
            <Link to="/cart" className="header-action cart-link" aria-label={`Shopping cart, ${count} item${count === 1 ? '' : 's'}`}>
              <span className="cart-link__icon">
                <Icon name="cart" size={24} />
                <span className="cart-badge" data-testid="cart-count">
                  {count}
                </span>
              </span>
              <span className="header-action__label hide-sm">
                <small>Your</small>
                <strong>Cart</strong>
              </span>
            </Link>
          </div>
        </div>
        <div className="container show-md header-search-mobile">
          <SearchBar />
        </div>
      </div>

      <nav className="category-nav hide-md" aria-label="Product categories">
        <div className="container category-nav__inner">
          <NavLink to="/shop" end className="nav-link">
            All Products
          </NavLink>
          <MegaMenu
            title="African Groceries"
            region="african"
            categories={african}
            open={menu === 'african'}
            onToggle={() => setMenu('african')}
            onClose={() => setMenu(null)}
          />
          <MegaMenu
            title="Caribbean Groceries"
            region="caribbean"
            categories={caribbean}
            open={menu === 'caribbean'}
            onToggle={() => setMenu('caribbean')}
            onClose={() => setMenu(null)}
          />
          <Link to="/shop?deals=1" className="nav-link nav-link--accent">
            <Icon name="tag" size={16} /> Weekly Deals
          </Link>
          <Link to="/shop?bestSeller=1" className="nav-link">
            Best Sellers
          </Link>
          <Link to="/shop?category=tropical-fruits" className="nav-link">
            Fresh Produce
          </Link>
          <Link to="/shop?category=jamaican-products" className="nav-link">
            Taste of Jamaica
          </Link>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`drawer-backdrop ${drawer ? 'is-open' : ''}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer ${drawer ? 'is-open' : ''}`} aria-hidden={!drawer} aria-label="Menu">
        <div className="drawer__head">
          <Logo />
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer__body">
          <Link to="/shop" className="drawer__link">
            All Products
          </Link>
          <Link to="/shop?deals=1" className="drawer__link drawer__link--accent">
            Weekly Deals
          </Link>
          <Link to="/shop?bestSeller=1" className="drawer__link">
            Best Sellers
          </Link>
          <p className="drawer__heading">African Groceries</p>
          {african.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className="drawer__link drawer__link--sub">
              {c.name}
            </Link>
          ))}
          <p className="drawer__heading">Caribbean Groceries</p>
          {caribbean.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className="drawer__link drawer__link--sub">
              {c.name}
            </Link>
          ))}
          <p className="drawer__heading">Account</p>
          {user ? (
            <>
              <Link to="/account" className="drawer__link">
                My account
              </Link>
              {isAdmin && (
                <Link to="/admin" className="drawer__link">
                  Admin dashboard
                </Link>
              )}
              <button type="button" className="drawer__link" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="drawer__link">
                Sign in
              </Link>
              <Link to="/register" className="drawer__link">
                Create an account
              </Link>
            </>
          )}
        </div>
      </aside>
    </header>
  );
}
