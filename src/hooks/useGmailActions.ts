import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { AGENT_ACTIONS_QUERY_KEY } from './useAgentAction';

/**
 * Gmail draft + send (FE-021 email response step) against Inbox-api BE-034
 * (`POST /gmail/draft`, `POST /gmail/send`). Approving the `draft_email` /
 * `send_email` AgentActions (BE-032) only records consent — the content
 * rides on these routes, which claim the actions and mark them verified.
 * Email content is never persisted; only returned IDs are recorded.
 */

/** Body of `POST /gmail/draft` — content rendered verbatim from the draft_email action. */
export interface GmailDraftInput {
  agentActionId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

/** Success body of `POST /gmail/draft`. */
export interface GmailDraftResponse {
  draftId: string;
}

/** Body of `POST /gmail/send`. */
export interface GmailSendInput {
  agentActionId: string;
  draftId: string;
}

/** Success body of `POST /gmail/send`. */
export interface GmailSendResponse {
  messageId: string;
  sent: true;
}

/** Creates the Gmail draft for an approved `draft_email` action. */
export function useCreateGmailDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GmailDraftInput) =>
      apiFetch<GmailDraftResponse>('/gmail/draft', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY }),
  });
}

/** Sends a created draft for an approved `send_email` action (Level 3). */
export function useSendGmailDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GmailSendInput) =>
      apiFetch<GmailSendResponse>('/gmail/send', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY }),
  });
}