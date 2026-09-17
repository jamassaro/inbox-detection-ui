import { useCallback, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ErrorState from '../../components/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ActionButton from '../../components/ActionButton';
import { startGmailConnect, useGmailStatus } from '../../hooks/useGmailStatus';
import { useToast } from '../../hooks/useToast';

/**
 * Gmail connect step of onboarding (FE-008). The backend redirects here
 * after the Gmail OAuth full-page redirect chain, so the page re-checks
 * status on every mount (see useGmailStatus) and routes:
 * connected → /app/dashboard, disconnected + `?error=` → in-place error
 * with a retry that restarts the OAuth flow, otherwise the trust-first
 * explanation with the single "Connect Gmail" CTA.
 *
 * Authentication itself is NOT re-checked here — `/onboarding` sits behind
 * ProtectedRoute (FE-003), which redirects unauthenticated visits to `/`.
 */

const DASHBOARD_PATH = '/app/dashboard';

/** Visible "Checking your Gmail connection…" state shown while status resolves. */
export const ConnectGmailLoading = () => {
  const { t } = useTranslation('onboarding');

  return (
    // LoadingSpinner owns role="status" — the wrapper stays a plain live
    // region so the page exposes exactly one status landmark.
    <div className="flex-1 flex flex-col items-center justify-center gap-4" aria-live="polite">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-600">{t('gmailConnect.checking')}</p>
    </div>
  );
};

/** Gmail OAuth failure state (backend returned `?error=`) — retry restarts the flow. */
export const ConnectGmailError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation('errors');

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <ErrorState title={t('gmailConnectFailed')} onRetry={onRetry} />
    </div>
  );
};

/**
 * The connect offer itself: an honest account of what is accessed (subject,
 * sender, body) and why (to find discoveries), the privacy assurance with a
 * `/privacy` link, and exactly one CTA.
 */
export const ConnectGmailContent = ({ onConnect }: { onConnect: () => void }) => {
  const { t } = useTranslation('onboarding');

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t('gmailConnect.title')}</h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">{t('gmailConnect.explanation')}</p>
        <p className="mt-6 text-sm text-gray-500">
          {t('gmailConnect.privacyAssurance')}{' '}
          <Link
            to="/privacy"
            className="underline underline-offset-2 hover:text-gray-900"
          >
            {t('gmailConnect.privacyLink')}
          </Link>
        </p>
        <ActionButton size="lg" className="mt-8 w-full" onClick={onConnect}>
          {t('gmailConnect.cta')}
        </ActionButton>
      </div>
    </div>
  );
};

const ConnectGmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useGmailStatus();

  const oauthFailed = searchParams.has('error');
  const connected = data?.connected === true;

  // Post-OAuth return: the backend lands back on this route after the
  // redirect chain, so the fresh-on-mount status check (useGmailStatus) is
  // what detects the now-connected state and advances to the dashboard.
  useEffect(() => {
    if (connected) {
      navigate(DASHBOARD_PATH, { replace: true });
    }
  }, [connected, navigate]);

  // FE-007 pattern (LandingPage's useSignIn): when the API base URL is
  // unconfigured nothing is navigated — a translated toast explains instead
  // of a silent dead click.
  const handleConnect = useCallback(() => {
    if (!startGmailConnect()) {
      toast.error(tErrors('connectUnavailable'));
    }
  }, [toast, tErrors]);

  let content;
  if (connected || isLoading) {
    // While redirecting after a connected check, keep showing the loading
    // state — no flash of the CTA between mount and navigation.
    content = <ConnectGmailLoading />;
  } else if (oauthFailed) {
    // The backend explicitly reported the OAuth leg failed — restarting the
    // flow is the only meaningful retry (a status refetch cannot succeed).
    content = <ConnectGmailError onRetry={handleConnect} />;
  } else if (isError) {
    // Status check itself failed (network/backend down) — default
    // errors.generic title; retry re-runs the check.
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  } else {
    content = <ConnectGmailContent onConnect={handleConnect} />;
  }

  return <div className="flex min-h-screen flex-col bg-gray-50">{content}</div>;
};

export default ConnectGmailPage;
