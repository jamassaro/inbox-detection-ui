import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Gmail connection status for the signed-in user, as returned by
 * `GET /gmail/status` (FE-008). `lastSync` is an ISO-8601 timestamp of the
 * most recent completed investigation sync, or null before the first one.
 */
export interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
}

/**
 * TanStack Query cache key for Gmail connection status. Exported so other
 * surfaces (FE-010 wires the Sidebar "Connected" chip) read or invalidate
 * the same cache entry instead of opening a second one.
 */
export const GMAIL_STATUS_QUERY_KEY = ['gmail', 'status'] as const;

/**
 * Gmail connection status (`GET /gmail/status`).
 *
 * Deliberately NOT cached across mounts. The ticket's scope sketch said
 * `staleTime: 30s`, but its Agent Notes override that: after the Gmail OAuth
 * full-page redirect the backend lands the user back on `/onboarding`, and
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
    queryFn: () => apiFetch<GmailStatus>('/gmail/status'),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

/**
 * Kicks off the Gmail OAuth flow — a FULL PAGE redirect to the backend's
 * `/gmail/connect` (FE-008), never a fetch/XHR: the browser must follow the
 * backend's redirect chain (Google consent → backend callback) for the
 * httpOnly session cookie to be updated. Mirrors useGoogleAuth's guard:
 * resolves `VITE_API_BASE_URL` at call time and refuses to navigate to an
 * undefined URL when it is missing (the caller shows the translated
 * fallback).
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

  window.location.href = `${baseUrl}/gmail/connect`;
  return true;
}
