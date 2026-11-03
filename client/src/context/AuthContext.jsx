import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

/** Session state. The JWT lives in an httpOnly cookie; the client only knows the user profile. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api.post('/auth/login', { email, password });
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: u } = await api.post('/auth/register', payload);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === 'admin', login, register, logout, setUser }),
    [user, ready, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
