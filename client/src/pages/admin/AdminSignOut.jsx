import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { PageLoader } from '../../components/ui';
import { AuthShell } from '../AuthPages';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/**
 * Separate "Admin sign out" screen (/admin/sign-out). Ends only the admin-dashboard session;
 * a customer signed in to the shop stays signed in. Reachable from the footer and from the
 * bar at the top of every admin page.
 */
export default function AdminSignOut() {
  useDocumentTitle('Admin sign out');
  const { ready, admin, user, adminLogout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!ready) return <PageLoader />;

  const shopUser = user && user.role !== 'admin' ? user : null;

  async function signOut() {
    setBusy(true);
    await adminLogout();
    setDone(true);
    setBusy(false);
  }

  if (done || !admin) {
    return (
      <div className="container">
        <AuthShell
          title={done ? 'Signed out of admin' : 'Not signed in to admin'}
          subtitle={done ? 'You have signed out of the admin dashboard on this browser.' : 'Nobody is signed in to the admin dashboard on this browser.'}
          footer={<Link to="/">← Back to the shop</Link>}
        >
          <div className="stack">
            {shopUser ? (
              <div className="alert alert--info" role="status">
                <span>
                  You're still signed in to the shop as <strong>{shopUser.email}</strong>.
                </span>
              </div>
            ) : (
              <p className="muted small">You're not signed in to the shop either.</p>
            )}
            <Link to="/" className="btn btn--primary btn--lg btn--block">
              Continue to the shop
            </Link>
            <Link to="/admin" className="btn btn--outline btn--block">
              Sign in to admin
            </Link>
          </div>
        </AuthShell>
      </div>
    );
  }

  return (
    <div className="container">
      <AuthShell title="Admin sign out" subtitle="Sign out of the admin dashboard on this browser." footer={<Link to="/admin">← Back to the dashboard</Link>}>
        <div className="stack">
          <div className="alert alert--info">
            <span>
              Signed in to the admin dashboard as <strong>{admin.name}</strong> ({admin.email}).
            </span>
          </div>
          {shopUser && (
            <p className="small">
              The shop sign-in for <strong>{shopUser.email}</strong> is separate and will stay signed in.
            </p>
          )}
          <button type="button" className="btn btn--danger btn--lg btn--block" onClick={signOut} disabled={busy}>
            <Icon name="logout" size={18} /> {busy ? 'Signing out…' : 'Sign out of admin'}
          </button>
        </div>
      </AuthShell>
    </div>
  );
}
