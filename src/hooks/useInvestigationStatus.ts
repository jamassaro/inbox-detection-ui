import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Ambient scan-status hooks: "what did the agent last do, and when will it
 * run again" for the dashboard widget. Distinct from useInvestigation(id) in
 * useInvestigation.ts, which polls one specific run by id for the FE-009
 * onboarding flow — this reads the backend's own idea of the latest run and
 * the continuous-monitoring schedule, with no id required.
 *
 * Wire contract: `GET /investigation/status` — no params.
 * `{ latestScan: { id, status, startedAt, completedAt, emailsProcessed,
 * emailsDiscovered, discoveriesCreated } | null, monitoring: { enabled,
 * intervalMinutes, nextScanAt } }`. `latestScan` is null only for a user who
 * has never run a scan. `monitoring.enabled` is the backend's resolved Pro
 * entitlement for continuous monitoring — never re-derived from the plan
 * name client-side (AGENTS.md: entitlements are backend-determined).
 */

export const INVESTIGATION_STATUS_QUERY_KEY = ['investigation', 'status'] as const;

/** Refetch cadence — short enough to notice an automatic re-scan starting without a push channel. */
export const INVESTIGATION_STATUS_POLL_MS = 60_000;

export const INVESTIGATION_STATUS_PATH = '/investigation/status';

export type LatestScanStatus = 'queued' | 'running' | 'completed' | 'failed';

/** `latestScan` on the wire body — null when the user has never scanned. */
export interface LatestScanWire {
  id: string;
  status: LatestScanStatus;
  startedAt: string | null;
  completedAt: string | null;
  emailsProcessed: number;
  emailsDiscovered: number;
  discoveriesCreated: number;
}

/** Wire body of `GET /investigation/status`. */
export interface InvestigationStatusWire {
  latestScan: LatestScanWire | null;
  monitoring: {
    enabled: boolean;
    intervalMinutes: number;
    nextScanAt: string | null;
  };
}

/**
 * `retry: false` matches the other status hooks (useGmailStatus,
 * useInvestigation): a failed read surfaces immediately as this widget's
 * error state instead of three silent retries. `refetchOnWindowFocus`
 * inherits the queryClient default (true), covering "whenever the tab
 * regains focus" without extra code.
 */
export function useInvestigationStatus() {
  return useQuery({
    queryKey: INVESTIGATION_STATUS_QUERY_KEY,
    queryFn: () => apiFetch<InvestigationStatusWire>(INVESTIGATION_STATUS_PATH),
    refetchInterval: INVESTIGATION_STATUS_POLL_MS,
    retry: false,
  });
}

/** Re-fetches the scan status immediately (e.g. right after a run finishes) instead of waiting for the next poll tick. */
export function useRefreshInvestigationStatus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: INVESTIGATION_STATUS_QUERY_KEY });
}

/** True for the two non-terminal wire statuses — a scan is actively queued or running. */
export const isScanRunning = (status: LatestScanStatus): boolean =>
  status === 'queued' || status === 'running';

/**
 * True when the backend's own idea of the latest scan is still in flight —
 * whether the user's own manual trigger, another tab, or Pro's automatic
 * hourly re-scan started it. The one shared "is a scan active right now"
 * signal every trigger control (Sidebar's button, the floating status
 * widget) reads before deciding whether to disable itself.
 */
export function useIsScanActive(): boolean {
  const { data } = useInvestigationStatus();
  return data?.latestScan != null && isScanRunning(data.latestScan.status);
}

/**
 * Fixed lookback window every scan this frontend triggers covers — matches
 * `startInvestigationSchema`'s default in the backend (BE-025/BE-036).
 * `useTriggerInvestigation` never sends a `periodDays` override, so this is
 * accurate for every run today; neither `/investigation/status` nor
 * `/investigation/:id` put `periodDays` on the wire, so it can't be read
 * back instead. If the backend default ever changes, or a lookback
 * selector is added to the UI, this constant must move with it — or,
 * better, the backend should start returning `periodDays` so the frontend
 * stops assuming it.
 */
export const INVESTIGATION_LOOKBACK_DAYS = 14;

/**
 * The calendar window a scan covers: `[anchor - lookback, anchor]`, where
 * `anchor` is the scan's own `startedAt` (the moment the backend actually
 * began reading, and so the correct reference point for "last N days") —
 * or, before that timestamp exists yet (queued, or optimistically written
 * by useTriggerInvestigation right after the POST resolves), the current
 * time as the best available estimate.
 */
export function scanLookbackRange(startedAt: string | null): { start: Date; end: Date } {
  const end = startedAt ? new Date(startedAt) : new Date();
  const start = new Date(end.getTime() - INVESTIGATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}
