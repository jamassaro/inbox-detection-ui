import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import ActionButton from './ActionButton';
import ErrorState from './ErrorState';
import UpgradePrompt from './UpgradePrompt';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useLocale } from '../hooks/useLocale';
import { useInvestigation, useTriggerInvestigation } from '../hooks/useInvestigation';
import {
  INVESTIGATION_LOOKBACK_DAYS,
  isScanRunning,
  scanLookbackRange,
  useInvestigationStatus,
  useRefreshInvestigationStatus,
} from '../hooks/useInvestigationStatus';
import { formatDate, formatNumber, formatRelativeDate } from '../lib/formatting';

const ONBOARDING_INVESTIGATING_PATH = '/onboarding/investigating';

/**
 * Corner "extension-style" widget for every authenticated page (mounted in
 * AppLayout, alongside Sidebar): a small always-present toggle that expands
 * into the same scan-status panel that used to live inline on the dashboard.
 * Collapsed by default so it never competes with page content; a colored
 * dot signals when something is actually happening (scanning, or needs
 * attention) without opening the panel.
 *
 * Backed by `GET /investigation/status` (useInvestigationStatus) — see that
 * module's docs for the wire contract. Sidebar's manual "Scan Inbox" button
 * reads the same shared query (useIsScanActive) to disable itself while any
 * scan — this widget's own, another tab's, or Pro's automatic hourly
 * re-scan — is active, so the two controls can never disagree.
 */
const ScanStatusWidget = () => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const status = useInvestigationStatus();
  const refreshStatus = useRefreshInvestigationStatus();
  const trigger = useTriggerInvestigation();

  const wireLatestScan = status.data?.latestScan ?? null;
  const activeId = wireLatestScan && isScanRunning(wireLatestScan.status) ? wireLatestScan.id : null;
  const liveProgress = useInvestigation(activeId);
  const liveIsActive =
    activeId !== null && (liveProgress.status === 'starting' || liveProgress.status === 'running');
  const animatedEmails = useAnimatedNumber(liveProgress.emailsReviewed);

  // The moment a live-tracked run ends, refetch the authoritative summary
  // (it has discoveriesCreated, which the per-run poll does not) instead of
  // waiting for the next 60s status poll. settledIdRef guards against
  // invalidating on every render while that refetch is in flight.
  const settledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeId === null) return;
    if (liveProgress.status !== 'complete' && liveProgress.status !== 'failed') return;
    if (settledIdRef.current === activeId) return;
    settledIdRef.current = activeId;
    void refreshStatus();
  }, [activeId, liveProgress.status, refreshStatus]);

  const lookback = wireLatestScan ? scanLookbackRange(wireLatestScan.startedAt) : null;
  const neverScanned = !status.isPending && !status.isError && wireLatestScan === null;
  const failed = wireLatestScan?.status === 'failed';
  const needsAttention = status.isError || (!liveIsActive && failed);

  const handleStartFirstScan = () => {
    trigger.mutate(undefined, {
      onSuccess: ({ id }) => navigate(`${ONBOARDING_INVESTIGATING_PATH}?investigationId=${id}`),
    });
  };
  const handleRetry = () => trigger.mutate(undefined);

  let panel: ReactNode;
  if (status.isPending) {
    panel = (
      <div aria-hidden="true" className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
      </div>
    );
  } else if (status.isError) {
    panel = <ErrorState title={t('scanStatus.error')} onRetry={() => void status.refetch()} />;
  } else if (liveIsActive || (activeId !== null && !liveIsActive)) {
    // Either genuinely ticking, or the run just ended and the authoritative
    // refetch triggered above hasn't landed yet — both read as "in
    // progress" so there is no flash back to a stale summary.
    panel = (
      <div aria-live="polite">
        <p className="text-sm text-gray-500">{t('scanStatus.scanning')}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
          {formatNumber(animatedEmails, locale)}
        </p>
        <p className="text-xs text-gray-500">{t('scanStatus.emailsReviewed')}</p>
        {lookback && (
          <p className="mt-2 text-xs text-gray-500" data-testid="lookback-range">
            {t('scanStatus.reviewingRange', {
              days: INVESTIGATION_LOOKBACK_DAYS,
              start: formatDate(lookback.start, locale),
              end: formatDate(lookback.end, locale),
            })}
          </p>
        )}
      </div>
    );
  } else if (neverScanned) {
    panel = (
      <div>
        <p className="text-sm text-gray-600">{t('scanStatus.neverScanned')}</p>
        <ActionButton size="sm" className="mt-3" isLoading={trigger.isPending} onClick={handleStartFirstScan}>
          {t('actions.scanInbox')}
        </ActionButton>
      </div>
    );
  } else if (failed) {
    panel = <ErrorState title={t('scanStatus.failed')} onRetry={handleRetry} />;
  } else {
    // 'completed'
    panel = (
      <div>
        <p className="text-sm text-gray-600">
          {t('scanStatus.lastScan', {
            time: formatRelativeDate(
              wireLatestScan?.completedAt ?? wireLatestScan?.startedAt ?? new Date().toISOString(),
              locale,
            ),
            count: wireLatestScan?.discoveriesCreated ?? 0,
          })}
        </p>
        {lookback && (
          <p className="mt-1 text-xs text-gray-500" data-testid="lookback-range">
            {t('scanStatus.reviewedRange', {
              days: INVESTIGATION_LOOKBACK_DAYS,
              start: formatDate(lookback.start, locale),
              end: formatDate(lookback.end, locale),
            })}
          </p>
        )}
      </div>
    );
  }

  const monitoring = status.data?.monitoring ?? null;
  const showDot = liveIsActive || needsAttention;

  return (
    <div className="fixed top-4 right-4 z-40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('scanStatus.title')}
        data-testid="scan-status-toggle"
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-colors hover:bg-gray-800"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
        {showDot && (
          <span
            aria-hidden="true"
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${
              liveIsActive ? 'animate-pulse bg-blue-500' : 'bg-red-500'
            }`}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          data-testid="scan-status-panel"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {t('scanStatus.title')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('buttons.close')}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3">{panel}</div>

          {monitoring && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              {monitoring.enabled ? (
                <p className="text-sm text-gray-500" data-testid="next-scan">
                  {monitoring.nextScanAt
                    ? t('scanStatus.nextScan', { time: formatRelativeDate(monitoring.nextScanAt, locale) })
                    : t('scanStatus.nextScanPending')}
                </p>
              ) : (
                <UpgradePrompt feature="continuousMonitoring" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanStatusWidget;
