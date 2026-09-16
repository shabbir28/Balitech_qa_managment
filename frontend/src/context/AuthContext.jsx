import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// The cached copy is only a fallback when /auth/me is unreachable; refuse
// anything that is not a real user object so a corrupt entry can't grant a role.
const readCachedUser = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('user') || 'null');
    if (parsed && typeof parsed === 'object' && parsed.id && typeof parsed.role === 'string') return parsed;
  } catch { /* fall through */ }
  localStorage.removeItem('user');
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } else {
        setUser(readCachedUser());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // Stable identity: pages put hasRole in useCallback/useEffect dependency
  // arrays, so a fresh function each render would re-fetch forever.
  const hasRole = useCallback(
    (...roles) => Boolean(user) && roles.includes(user.role),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasRole, loadUser }),
    [user, loading, login, logout, hasRole, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
