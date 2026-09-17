import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { AccountConnectionsWire } from '../types';

/** Gmail connection status for the signed-in user. */
export interface GmailStatus {
  connected: boolean;
  email: string | null;
  /** ISO-8601 timestamp of the most recent completed scan, or null before the first one. */
  lastSync: string | null;
}

/**
 * Wire body of `GET /stats` — only the field this hook consumes. `lastScan`
 * is the user's newest scanHistory row (Inbox-api stats.routes.ts, verified
 * 2026-09-17), written by the email-scan pipeline.
 */
interface StatsWire {
  lastScan: { scanDate: string } | null;
}

/**
 * TanStack Query cache key for Gmail connection status. Exported so other
 * surfaces (FE-010 wires the Sidebar "Connected" chip) read or invalidate
 * the same cache entry instead of opening a second one.
 */
export const GMAIL_STATUS_QUERY_KEY = ['gmail', 'status'] as const;

/**
 * Gmail connection status, derived from the endpoints the backend actually
 * serves (verified 2026-09-17 — there is no `GET /gmail/status`):
 *
 * - `GET /account/connections` (BE-035) reports `gmail.connected` and the
 *   account email. Sign-in itself requests `gmail.readonly`, so Gmail is
 *   connected from the first login on.
 * - `GET /stats` reports `lastScan`, the newest scanHistory row — the real
 *   "last sync" for the agent badge.
 *
 * Deliberately NOT cached across mounts. After the Gmail OAuth full-page
 * redirect the backend lands the user back on `/onboarding`, and
 * ConnectGmailPage must see the post-OAuth state on that very mount — a
 * cached `connected: false` from before the redirect would send the user
 * back to the CTA instead of advancing to the dashboard. `staleTime: 0` +
 * `refetchOnMount: 'always'` make every mount a fresh check.
 *
 * `retry: false` matches the AuthCallbackPage query: a failing status check
 * surfaces immediately as the page's error state with a retry CTA, instead
 * of three silent TanStack retries stretching the onboarding wait.
 */
export function useGmailStatus() {
  return useQuery({
    queryKey: GMAIL_STATUS_QUERY_KEY,
    queryFn: async (): Promise<GmailStatus> => {
      const [connections, stats] = await Promise.all([
        apiFetch<AccountConnectionsWire>('/account/connections'),
        apiFetch<StatsWire>('/stats'),
      ]);
      return {
        connected: connections.gmail.connected,
        email: connections.gmail.connected ? connections.gmail.email : null,
        lastSync: stats.lastScan?.scanDate ?? null,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

/**
 * Re-runs Google OAuth for the signed-in state — the only way the backend
 * can (re)connect Gmail: the initial `GET /auth/google` sign-in already
 * requests `gmail.readonly`, so the connection is (re)established by the
 * same full-page redirect chain the login uses. There is no
 * `GET /gmail/connect` on the backend (verified 2026-09-17); the compose
 * increment is the separate Pro-gated `/gmail/connect-compose` flow.
 *
 * Never a fetch/XHR: the browser must follow the backend's redirect chain
 * (Google consent → backend callback) for the httpOnly session cookie to be
 * updated. Mirrors useGoogleAuth's guard: resolves `VITE_API_BASE_URL` at
 * call time and refuses to navigate to an undefined URL when it is missing
 * (the caller shows the translated fallback).
 *
 * @returns `true` when the redirect was started, `false` when the API base
 * URL is unconfigured (nothing was navigated).
 */
export function startGmailConnect(): boolean {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    console.error(
      '[startGmailConnect] VITE_API_BASE_URL is not configured — cannot start Gmail OAuth. ' +
        'Set it in your environment (see .env.example).',
    );
    return false;
  }

  window.location.href = `${baseUrl}/auth/google`;
  return true;
}
