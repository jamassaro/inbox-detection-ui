import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, AUTH_EXPIRED_EVENT } from '../lib/apiClient';
import { AuthContext } from './authContext';
import type { User } from '../types';

/**
 * Session auth via httpOnly cookie. Session state comes exclusively from
 * `GET /auth/me` — the frontend never reads or stores auth tokens
 * (AGENTS.md Authentication rules).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const me = await apiFetch<User>('/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        // 401 or network failure — no valid session.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      window.location.replace('/');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort: the session cookie may already be gone.
    }
    setUser(null);
    window.location.replace('/');
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, isLoading, logout }),
    [user, isLoading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

