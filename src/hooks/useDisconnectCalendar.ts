import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { CALENDAR_STATUS_QUERY_KEY } from './useCalendarStatus';

/**
 * Disconnects Google Calendar for the signed-in user.
 *
 * Endpoint reality (verified against Inbox-api BE-035): the ticket's
 * `DELETE /calendar/connection` does not exist; the backend's disconnect
 * surface is `DELETE /account/disconnect/calendar`. On success it clears
 * only the Calendar connection (Gmail is untouched), so only the Calendar
 * status cache is invalidated.
 *
 * Per FE-023 the user stays on the settings page — the invalidated status
 * query refetches and the row flips to its not-connected state.
 */
export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ disconnected: boolean }>('/account/disconnect/calendar', { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CALENDAR_STATUS_QUERY_KEY }),
  });
}
