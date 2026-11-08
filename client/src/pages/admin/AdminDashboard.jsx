import { Link } from 'react-router-dom';
import { ErrorState, PageLoader, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import RevenueChart from '../../components/admin/RevenueChart';
import { formatDateTime, formatMoney } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi('/admin/stats');
  const sales = useApi('/admin/sales', { range: '30d' });
  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const tiles = [
    ['Revenue (paid orders)', formatMoney(data.revenue)],
    ['Paid orders', data.paidOrders],
    ['Awaiting fulfilment', data.pendingFulfilment],
    ['Products', data.productCount],
    ['Customers', data.customers],
  ];

  return (
    <div className="stack">
      <div className="admin__head">
        <h1>Dashboard</h1>
        <Link to="/admin/products/new" className="btn btn--primary">
          + Add product
        </Link>
      </div>
      <div className="stat-grid">
        {tiles.map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat__label">{label}</span>
            <strong className="stat__value">{value}</strong>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="admin__head">
          <div>
            <h2>Sales — last 30 days</h2>
            {sales.data && (
              <p className="muted small">
                {formatMoney(sales.data.summary.grossSales)} from {sales.data.summary.orders} {sales.data.summary.orders === 1 ? 'order' : 'orders'}
              </p>
            )}
          </div>
          <Link to="/admin/sales" className="link-arrow">
            Sales report →
          </Link>
        </div>
        {sales.data ? <RevenueChart series={sales.data.series} compact /> : sales.error ? <p className="muted small">{sales.error.message}</p> : <PageLoader />}
      </section>

      <div className="admin-two">
        <section className="card">
          <div className="admin__head">
            <h2>Recent orders</h2>
            <Link to="/admin/orders" className="link-arrow">
              All orders →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="muted">
                      No orders yet.
                    </td>
                  </tr>
                )}
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/admin/orders?open=${o.id}`}>{o.orderNumber}</Link>
                      <small className="muted block">{formatDateTime(o.createdAt)}</small>
                    </td>
                    <td>
                      {o.customer.firstName} {o.customer.lastName}
                    </td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="admin__head">
            <h2>Low stock</h2>
            <Link to="/admin/inventory?status=low" className="link-arrow">
              Manage →
            </Link>
          </div>
          <ul className="low-stock-list">
            {data.lowStock.length === 0 && <li className="muted">All products are well stocked.</li>}
            {data.lowStock.map((p) => (
              <li key={p._id}>
                <Link to={`/admin/products/${p._id}`}>{p.name}</Link>
                <span className={`badge ${p.totalStock === 0 ? 'badge--failed' : 'badge--awaiting_payment'}`}>{p.totalStock} left</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
