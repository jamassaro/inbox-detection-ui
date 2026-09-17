import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { AGENT_ACTIONS_QUERY_KEY } from './useAgentAction';

/**
 * Calendar event creation (FE-021) against Inbox-api BE-033
 * (`POST /calendar/events`). The route requires an APPROVED
 * `create_calendar_event` AgentAction owned by the caller — approving the
 * action first (BE-032) is the caller's job; this mutation books the event
 * with the chosen slot and the backend consumes the action (status →
 * `verified`) only after Google accepts the event.
 */

/** Body of `POST /calendar/events` (BE-033; end must be after start). */
export interface CreateCalendarEventInput {
  agentActionId: string;
  title: string;
  /** ISO-8601 datetime. */
  start: string;
  /** ISO-8601 datetime, strictly after `start`. */
  end: string;
  attendees?: string[];
  description?: string;
}

/** Success body — the created Google event's id. */
export interface CreateCalendarEventResponse {
  eventId: string;
}

/** Books the meeting on the user's primary calendar. */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarEventInput) =>
      apiFetch<CreateCalendarEventResponse>('/calendar/events', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // The action row just changed server-side (verified/failed) — refetch it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY }),
  });
}
