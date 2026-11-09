import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
  const { admin, user, adminLogout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  // Signs out of the admin dashboard only; a customer signed in to the shop stays signed in.
  async function signOutOfAdmin() {
    const shopUser = user && user.role !== 'admin' ? user : null;
    await adminLogout();
    navigate('/', { replace: true });
    notify(shopUser ? `Signed out of the admin dashboard. You're still signed in to the shop as ${shopUser.email}.` : 'Signed out of the admin dashboard.');
  }

  return (
    <div className="container admin">
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
          <button type="button" className="admin__link admin__signout" onClick={signOutOfAdmin}>
            <Icon name="logout" size={18} /> Sign out of admin
          </button>
        </div>
      </aside>
      <section className="admin__main">
        <Outlet />
      </section>
    </div>
  );
}
