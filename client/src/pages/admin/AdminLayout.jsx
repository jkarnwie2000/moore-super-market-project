import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const LINKS = [
  ['/admin', 'Dashboard', 'grid'],
  ['/admin?tab=in-store', 'In-store sale', 'store'],
  ['/admin/sales', 'Sales', 'chart'],
  ['/admin/orders', 'Orders', 'receipt'],
  ['/admin/inventory', 'Inventory', 'layers'],
  ['/admin/products', 'Products', 'box'],
  ['/admin/categories', 'Categories', 'folder'],
  ['/admin/promotions', 'Promotions', 'percent'],
];

export default function AdminLayout() {
  useDocumentTitle('Admin');
  const { pathname, search } = useLocation();
  const onDashboard = pathname === '/admin' || pathname === '/admin/';
  const inStoreTab = onDashboard && new URLSearchParams(search).get('tab') === 'in-store';

  // The dashboard and its In-store tab share a path, so the query decides which link is active.
  const isActive = (to) => {
    if (to === '/admin') return onDashboard && !inStoreTab;
    if (to === '/admin?tab=in-store') return inStoreTab;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <div className="container admin">
      <aside className="admin__nav" aria-label="Admin navigation">
        <p className="eyebrow">Store admin</p>
        {LINKS.map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={() => `admin__link ${isActive(to) ? 'active' : ''}`} aria-current={isActive(to) ? 'page' : undefined}>
            <Icon name={icon} size={18} /> {label}
          </NavLink>
        ))}
      </aside>
      <section className="admin__main">
        <Outlet />
      </section>
    </div>
  );
}
