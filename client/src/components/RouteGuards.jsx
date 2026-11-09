import { Navigate, useLocation } from 'react-router-dom';
import { AdminSignIn } from '../pages/AuthPages';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

/**
 * UI-level guard only — every admin API route is independently protected on the server.
 * Anyone who isn't signed in as an admin (signed out, or signed in as a customer) gets the
 * admin sign-in form right here instead of being turned away.
 */
export function RequireAdmin({ children }) {
  const { ready, isAdmin } = useAuth();
  if (!ready) return <PageLoader />;
  if (!isAdmin) return <AdminSignIn />;
  return children;
}
