import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Wire shape of `GET /account/connections` (Inbox-api BE-035) — Google
 * connection state for the signed-in user. Booleans only; tokens are never
 * echoed back.
 */
interface AccountConnections {
  gmail: { connected: boolean; email: string };
  calendar: { connected: boolean };
  gmailCompose: { enabled: boolean };
}

/**
 * Calendar connection status for the signed-in user.
 *
 * The backend has no dedicated `GET /calendar/status` endpoint; the real
 * surface is `GET /account/connections`, which reports Gmail, Calendar, and
 * compose state in one call (verified against Inbox-api BE-035). FE-023
 * reads the Calendar row from it. (The ticket listed FE-021's
 * `useCalendarStatus` as a dependency; that hook was never merged, so this
 * file establishes the contract against the endpoint that actually exists.)
 */
export interface CalendarStatus {
  connected: boolean;
}

/**
 * TanStack Query cache key for Calendar connection status. Exported so the
 * disconnect mutations (FE-023) invalidate this exact entry.
 */
export const CALENDAR_STATUS_QUERY_KEY = ['calendar', 'status'] as const;

/**
 * Calendar connection status. `refetchOnMount: 'always'` mirrors
 * useGmailStatus: the connection can flip through a full-page OAuth redirect,
 * so every mount must see fresh state.
 */
export function useCalendarStatus() {
  return useQuery({
    queryKey: CALENDAR_STATUS_QUERY_KEY,
    queryFn: async () => {
      const connections = await apiFetch<AccountConnections>('/account/connections');
      const status: CalendarStatus = { connected: connections.calendar.connected };
      return status;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

/**
 * Kicks off the Calendar OAuth flow: asks the backend for the consent URL
 * (`GET /calendar/connect` — full-page redirect, never XHR, so the browser
 * follows the Google consent → backend callback chain and the httpOnly
 * session cookie survives) and lands the user back in Settings afterwards
 * via the backend-sanitized `returnTo` param. Contextual flows (FE-021
 * meeting scheduling) pass their own `returnTo` so the user lands back on
 * the discovery that triggered the connect.
 *
 * @returns `true` when the redirect was started, `false` when the request
 * failed (caller shows the translated fallback).
 */
export async function startCalendarConnect(returnTo?: string): Promise<boolean> {
  try {
    // No returnTo → the legacy bare `/calendar/connect` (backend redirects
    // back to Settings by default, the contract FE-023 tests assert). Only
    // contextual flows pass an explicit returnTo.
    const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    const { authUrl } = await apiFetch<{ authUrl: string }>(`/calendar/connect${query}`);
    window.location.href = authUrl;
    return true;
  } catch (error) {
    console.error(
      '[startCalendarConnect] could not start Calendar OAuth — the consent URL request failed.',
      error,
    );
    return false;
  }
}
