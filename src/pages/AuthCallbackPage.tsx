import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { consumeReturnPath } from '../hooks/useGoogleAuth';
import { useAuth } from '../hooks/useAuth';
import ErrorState from '../components/ErrorState';
import LoadingSpinner from '../components/LoadingSpinner';
import type { User } from '../types';

/**
 * Redirect target of the backend Google OAuth flow (FE-007). The code
 * exchange happens backend-side (it sets the httpOnly session cookie); this
 * page only resolves the session with `GET /auth/me` and routes:
 * returnPath (sessionStorage) → else Gmail connected → /app/dashboard,
 * otherwise → /onboarding (connect Gmail).
 *
 * Failure shows an in-place translated error with a "Try again" CTA instead
 * of redirecting away — history stays intact, so the browser back button
 * still lands on the landing page.
 */

const DASHBOARD_PATH = '/app/dashboard';
const ONBOARDING_PATH = '/onboarding';

/**
 * A callback URL is only valid when the backend redirected here with a
 * `code` (success leg) — anything else (missing param, `?error=…` from the
 * backend's OAuth failure leg) is a failure before any session check.
 */
function isFailedCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('error') || !params.get('code');
}

/** Visible "Signing you in…" state shown while the session resolves. */
export const AuthCallbackLoading = () => {
  const { t } = useTranslation('onboarding');

  return (
    // LoadingSpinner owns role="status" — the wrapper stays a plain live
    // region so the page exposes exactly one status landmark.
    <div className="flex-1 flex flex-col items-center justify-center gap-4" aria-live="polite">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-600">{t('auth.signingIn')}</p>
    </div>
  );
};

/** In-place failure state — retry goes back to the landing page. */
export const AuthCallbackError = ({ onTryAgain }: { onTryAgain: () => void }) => {
  const { t } = useTranslation('errors');

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <ErrorState title={t('oauthFailed')} onRetry={onTryAgain} />
    </div>
  );
};

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  // AuthProvider (FE-003) checks GET /auth/me on app mount — on this route
  // that check IS the session resolution (the cookie was set by the backend
  // redirect chain). Compose with it: only if it settles WITHOUT a user do we
  // run the page's own Query (the driver for the no-session/failure paths),
  // so the happy path hits the endpoint exactly once.
  const { user: sessionUser, isLoading: sessionLoading } = useAuth();

  // window.location cannot change while this route is mounted (any change is
  // a full-page navigation), so reading it during render is stable.
  const failedEarly = isFailedCallback();

  const { data: queriedUser, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<User>('/auth/me'),
    enabled: !failedEarly && !sessionLoading && sessionUser === null,
    retry: false,
  });

  const user = sessionUser ?? queriedUser;
  const failed = failedEarly || isError;

  // Single navigation per mount — guards against StrictMode's double effect
  // invocation consuming the return path twice.
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (navigatedRef.current) return;
    if (!user) return;
    navigatedRef.current = true;
    const returnPath = consumeReturnPath();
    navigate(returnPath ?? (user.gmailConnected ? DASHBOARD_PATH : ONBOARDING_PATH), {
      replace: true,
    });
  }, [user, navigate]);

  const handleTryAgain = () => navigate('/', { replace: true });

  if (failed) {
    return <AuthCallbackError onTryAgain={handleTryAgain} />;
  }
  return <AuthCallbackLoading />;
};

export default AuthCallbackPage;
