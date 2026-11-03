import { NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const LINKS = [
  ['/admin', 'Dashboard', 'grid', true],
  ['/admin/products', 'Products', 'box'],
  ['/admin/categories', 'Categories', 'folder'],
  ['/admin/orders', 'Orders', 'receipt'],
  ['/admin/promotions', 'Promotions', 'percent'],
];

export default function AdminLayout() {
  useDocumentTitle('Admin');
  return (
    <div className="container admin">
      <aside className="admin__nav" aria-label="Admin navigation">
        <p className="eyebrow">Store admin</p>
        {LINKS.map(([to, label, icon, end]) => (
          <NavLink key={to} to={to} end={end} className="admin__link">
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
