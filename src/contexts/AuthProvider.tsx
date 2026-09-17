import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../lib/apiError';
import { apiFetch, AUTH_EXPIRED_EVENT } from '../lib/apiClient';
import { AuthContext } from './authContext';
import type { User } from '../types';

/**
 * Total attempts for a transient-failing bootstrap session check. Auth
 * failures never retry (they are terminal), so this bound only shapes
 * network-error behavior: a handful of spread attempts, no backoff loops.
 */
export const SESSION_CHECK_MAX_ATTEMPTS = 3;

/**
 * A 401 from the session check is a definitive "no session" — the answer,
 * not a failure to recover from. Retrying cannot change it.
 */
const isAuthFailure = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

/**
 * Session auth via httpOnly cookie. Session state comes exclusively from
 * `GET /account/me` — the frontend never reads or stores auth tokens
 * (AGENTS.md Authentication rules).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        // The session check's own 401 is the expected logged-out answer, so
        // it suppresses the auth:expired broadcast: that listener redirects
        // to `/`, which remounts the app and re-runs this check — an
        // unbounded reload/request storm where the landing never renders.
        for (let attempt = 1; attempt <= SESSION_CHECK_MAX_ATTEMPTS; attempt += 1) {
          try {
            const me = await apiFetch<User>('/account/me', { authExpiredEvent: false });
            if (!cancelled) setUser(me);
            return;
          } catch (error) {
            // Auth failures settle immediately; transient failures (network,
            // 5xx) fall through to the next bounded attempt — no backoff
            // delays on a once-per-app-load call, and never a request storm.
            if (isAuthFailure(error) || attempt === SESSION_CHECK_MAX_ATTEMPTS) {
              if (!cancelled) setUser(null);
              return;
            }
          }
        }
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

