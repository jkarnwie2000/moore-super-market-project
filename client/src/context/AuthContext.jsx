import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

/**
 * Session state. Sessions live in httpOnly cookies; the client only knows the profiles.
 * There are two independent sessions:
 *  - `user`: who is signed in to the shop (a customer, or an admin who used the normal sign-in);
 *  - `admin`: who is signed in to the admin dashboard.
 * Signing out of one leaves the other signed in.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get('/auth/me');
      setUser(me.user || null);
      setAdmin(me.admin || null);
    } catch {
      setUser(null);
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api.post('/auth/login', { email, password });
    setUser(u);
    if (u?.role === 'admin') setAdmin(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: u } = await api.post('/auth/register', payload);
    setUser(u);
    return u;
  }, []);

  /** Signs out of the shop only (the admin dashboard stays signed in if it has its own session). */
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    await refresh();
  }, [refresh]);

  /** Admin sign-in form: opens the admin session without touching the shop session. */
  const adminLogin = useCallback(async (email, password) => {
    const { admin: a } = await api.post('/auth/admin-login', { email, password });
    setAdmin(a);
    return a;
  }, []);

  /** Signs out of the admin dashboard only; a customer signed in to the shop stays signed in. */
  const adminLogout = useCallback(async () => {
    const res = await api.post('/auth/admin-logout').catch(() => null);
    setAdmin(null);
    if (res) setUser(res.user || null);
    else await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, admin, ready, isAdmin: Boolean(admin), login, register, logout, adminLogin, adminLogout, refresh, setUser, setAdmin }),
    [user, admin, ready, login, register, logout, adminLogin, adminLogout, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
