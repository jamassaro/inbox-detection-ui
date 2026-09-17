import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BILLING_STATUS_PATH, mapBillingStatusToEntitlements } from '../lib/entitlementsMapper';
import { apiFetch } from '../lib/apiClient';
import { clearUpgradeContext, readUpgradeContext } from '../lib/upgradeContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import type { BillingStatusWire, Entitlements } from '../types';

/** Where BE-030's checkout `success_url` returns after payment. */
export const CHECKOUT_SUCCESS_PATH = '/billing/success';

/**
 * Poll cadence and cap — 12 attempts × 2s ≈ 24s before surfacing the manual
 * refresh state (FE-017). The webhook normally beats the first poll; the cap
 * only exists so a stuck webhook can't spin forever.
 */
export const ENTITLEMENT_POLL_INTERVAL_MS = 2000;
export const ENTITLEMENT_MAX_POLL_ATTEMPTS = 12;

/** Return target when no upgrade context was saved before checkout (FE-017). */
export const DEFAULT_RETURN_PATH = '/app/discoveries';

type ActivationState = 'polling' | 'timeout' | 'error';

/**
 * Post-checkout activation screen (FE-017). Stripe redirects here after
 * payment; the page polls entitlements until Pro is confirmed, then restores
 * the saved upgrade context — refresh, read + clear sessionStorage, success
 * toast (fired BEFORE navigation so it survives the route change), and
 * navigate to the path the paywall interrupted.
 */
const UpgradeSuccessPage = () => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const { refresh } = useEntitlements();
  const toast = useToast();

  const [state, setState] = useState<ActivationState>('polling');
  // Bumping the key cancels the running loop and starts a fresh one — used by
  // both the error retry and the timeout's manual refresh.
  const [pollKey, setPollKey] = useState(0);

  // Latest-ref pattern: the poll loop reads callbacks through refs so a
  // mid-cycle identity change never restarts it (a restart would reset the
  // attempt counter); only pollKey may. Assignment happens in an effect, not
  // render — render-phase ref writes are not allowed.
  const refreshRef = useRef(refresh);
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    refreshRef.current = refresh;
    toastRef.current = toast;
    tRef.current = t;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      attempts += 1;
      try {
        // The backend has no /user/entitlements — the plan surface is
        // GET /billing/status (BE-030), mapped through the same pure
        // adapter the EntitlementProvider uses so this poll and the shared
        // cache can never disagree about what the wire body means.
        const status = await apiFetch<BillingStatusWire>(BILLING_STATUS_PATH);
        const entitlements: Entitlements = mapBillingStatusToEntitlements(status);
        if (cancelled) return;
        if (entitlements?.plan === 'pro') {
          // FE-017 order: refresh the shared cache, consume the saved
          // context, toast, then return the user to where the paywall
          // interrupted them. replace: the post-payment screen must not
          // re-run on back navigation.
          await refreshRef.current();
          if (cancelled) return;
          const ctx = readUpgradeContext();
          clearUpgradeContext();
          toastRef.current.success(tRef.current('success.toast'));
          // FE-020: an interrupted reminder resumes the exact flow — the
          // target discovery auto-opens the ReminderModal via the
          // ?openReminder=true entry point.
          if (ctx?.pendingAction === 'remind' && ctx.discoveryId !== undefined) {
            const base = ctx.returnPath || `/app/discoveries/${ctx.discoveryId}`;
            const separator = base.includes('?') ? '&' : '?';
            navigateRef.current(`${base}${separator}openReminder=true`, { replace: true });
            return;
          }
          navigateRef.current(ctx?.returnPath ?? DEFAULT_RETURN_PATH, { replace: true });
          return;
        }
      } catch {
        // Surface the failure immediately instead of silently retrying —
        // a broken webhook or entitlements path must be visible (FE-017).
        if (!cancelled) setState('error');
        return;
      }
      if (cancelled) return;
      if (attempts >= ENTITLEMENT_MAX_POLL_ATTEMPTS) {
        setState('timeout');
        return;
      }
      timer = setTimeout(() => {
        void poll();
      }, ENTITLEMENT_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Deps intentionally omit refresh/toast/t/navigate: they are read through
    // the latest-refs above precisely so identity churn mid-cycle cannot
    // restart the poll (a restart would reset the attempt counter). Only
    // pollKey may restart it.
  }, [pollKey]);

  const restartPolling = () => {
    setState('polling');
    setPollKey((key) => key + 1);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {state === 'polling' && (
        <div className="flex flex-col items-center gap-4 text-center" data-testid="activating-state">
          <LoadingSpinner size="lg" />
          <h1 className="text-xl font-semibold text-gray-900">{t('status.activating')}</h1>
          <p className="text-sm text-gray-500">{t('success.activatingSubcopy')}</p>
        </div>
      )}

      {state === 'timeout' && (
        <div className="flex flex-col items-center gap-4 text-center" data-testid="timeout-state">
          <LoadingSpinner size="lg" />
          <h1 className="text-xl font-semibold text-gray-900">{t('success.stillActivating')}</h1>
          <p className="max-w-sm text-sm text-gray-500">{t('success.timeoutSubcopy')}</p>
          <button
            type="button"
            onClick={restartPolling}
            data-testid="manual-refresh"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            {t('success.refreshManually')}
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="w-full max-w-md" data-testid="error-state">
          <ErrorState
            title={t('success.errorTitle')}
            description={t('success.errorDescription')}
            onRetry={restartPolling}
          />
        </div>
      )}
    </div>
  );
};

export default UpgradeSuccessPage;
