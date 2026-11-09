import { Link, NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const LINKS = [
  ['/admin', 'Dashboard', 'grid', true],
  ['/admin/sales', 'Sales', 'chart'],
  ['/admin/orders', 'Orders', 'receipt'],
  ['/admin/inventory', 'Inventory', 'layers'],
  ['/admin/products', 'Products', 'box'],
  ['/admin/categories', 'Categories', 'folder'],
  ['/admin/promotions', 'Promotions', 'percent'],
];

export default function AdminLayout() {
  useDocumentTitle('Admin');
  const { admin } = useAuth();

  return (
    <div className="container admin">
      <div className="admin__bar" role="region" aria-label="Admin session">
        <span>
          <Icon name="shield" size={16} /> Signed in to the admin dashboard{admin ? <> as <strong>{admin.name}</strong></> : null}
        </span>
        <Link to="/admin/sign-out" className="btn btn--danger-outline btn--sm">
          <Icon name="logout" size={16} /> Sign out of admin
        </Link>
      </div>
      <aside className="admin__nav" aria-label="Admin navigation">
        <p className="eyebrow">Store admin</p>
        {LINKS.map(([to, label, icon, end]) => (
          <NavLink key={to} to={to} end={end} className="admin__link">
            <Icon name={icon} size={18} /> {label}
          </NavLink>
        ))}
        <div className="admin__session">
          {admin && (
            <p className="small muted">
              Admin: <strong>{admin.name}</strong>
            </p>
          )}
          <Link to="/admin/sign-out" className="admin__link admin__signout">
            <Icon name="logout" size={18} /> Sign out of admin
          </Link>
        </div>
      </aside>
      <section className="admin__main">
        <Outlet />
      </section>
    </div>
  );
}
