import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const TOKEN_KEY = 'hr_token';
const USER_KEY  = 'hr_user';

// Helper for persistent cookies
const setAuthCookie = (name, value, days = 30) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`;
};

const getAuthCookie = (name) => {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
};

const removeAuthCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true); // True until session is restored

  // ── Restore session from localStorage or Cookie on mount ────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY) || getAuthCookie(TOKEN_KEY);
    const storedUser  = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsed);
        // Sync back to both if one was missing
        localStorage.setItem(TOKEN_KEY, storedToken);
        setAuthCookie(TOKEN_KEY, storedToken);
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        removeAuthCookie(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = data;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY,  JSON.stringify(newUser));
    setAuthCookie(TOKEN_KEY, newToken); // Store in cookie for long-term persistence
    
    setToken(newToken);
    setUser(newUser);

    return newUser;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    removeAuthCookie(TOKEN_KEY);
    
    setToken(null);
    setUser(null);
  }, []);

  // ── Refresh user from server ───────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const updated = data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      setUser(updated);
    } catch {
      logout();
    }
  }, [logout]);

  const updateUser = useCallback((updatedUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  const isAuthenticated = Boolean(token && user);
  const role = user?.role || null;

  // ── Role helpers ───────────────────────────────────────────────────────
  const isSuperAdmin = role === 'superadmin';
  const isOwner      = role === 'owner';
  const isTenant     = role === 'tenant';

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated, role, isSuperAdmin, isOwner, isTenant, login, logout, refreshUser, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Hook — throws if used outside AuthProvider */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
