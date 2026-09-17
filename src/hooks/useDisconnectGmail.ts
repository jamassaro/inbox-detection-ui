import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { GMAIL_STATUS_QUERY_KEY } from './useGmailStatus';
import { CALENDAR_STATUS_QUERY_KEY } from './useCalendarStatus';

/**
 * Disconnects Gmail for the signed-in user.
 *
 * Endpoint reality (verified against Inbox-api BE-035): the ticket's
 * `DELETE /gmail/connection` does not exist; the backend's disconnect
 * surface is `DELETE /account/disconnect/gmail`. On success it revokes the
 * Google grant and — because Calendar consent rides the same token pair —
 * clears the Calendar connection too, so both status caches are invalidated.
 *
 * Per FE-023, success then navigates to `/onboarding`: without Gmail the
 * app has nothing to monitor and the user must reconnect.
 */
export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ disconnected: boolean }>('/account/disconnect/gmail', { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: GMAIL_STATUS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_STATUS_QUERY_KEY }),
      ]);
      navigate('/onboarding', { replace: true });
    },
  });
}
