import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

/** UI-level guard only — every admin API route is independently protected on the server. */
export function RequireAdmin({ children }) {
  const { user, ready, isAdmin } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin) {
    return (
      <div className="container section">
        <div className="empty-state" role="alert">
          <h2>This account doesn't have admin access</h2>
          <p>
            You're signed in as <strong>{user.email}</strong>, which is a customer account. Sign out and sign in with the store's admin account to
            open the dashboard.
          </p>
          <Link to="/" className="btn btn--outline">
            Back to the shop
          </Link>
        </div>
      </div>
    );
  }
  return children;
}
