import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Agent actions API (FE-021) against Inbox-api BE-032 (`/actions`).
 *
 * Contract notes (verified against src/api/routes/actions.routes.ts):
 * - Actions are PROPOSED server-side by the worker pipeline; the client only
 *   lists, inspects, approves, and rejects. There is no client-driven
 *   "create action" endpoint.
 * - `POST /actions/:id/approve` and `/reject` take an EMPTY body (the route
 *   validates `emptyBodySchema`) and only transition `awaiting_approval`
 *   rows — anything else is a 400.
 * - Approving `draft_email`/`send_email` records consent and stops at
 *   `approved`; the actual draft/send happens through `POST /gmail/draft`
 *   and `POST /gmail/send` (BE-034). Calendar action types execute
 *   server-side on approve (BE-042).
 * - The list is ordered `createdAt` desc, so the first match is the newest.
 */

/** Action types on the wire — the five PRD types plus the audit-only rows the backend writes. */
export type AgentActionType =
  | 'create_reminder'
  | 'check_availability'
  | 'create_calendar_event'
  | 'draft_email'
  | 'send_email'
  | 'chat_message'
  | 'daily_briefing';

/** Action lifecycle — mirrors the backend status state machine. */
export type AgentActionStatus =
  | 'proposed'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'verified'
  | 'failed'
  | 'cancelled';

/**
 * Statuses the list route accepts as its `?status=` filter (BE-032). Note
 * `completed` is intentionally absent — audit rows are filtered client-side.
 */
export type AgentActionStatusFilter = Exclude<AgentActionStatus, 'completed'>;

/**
 * Wire shape of an AgentAction row. The three JSON-text columns arrive
 * PARSED (objects, or raw string if the stored JSON was corrupt) — see the
 * route's serializeAction.
 */
export interface AgentActionWire {
  id: string;
  userId: string;
  discoveryId: string | null;
  actionType: AgentActionType;
  /** 1 = auto, 2 = approval, 3 = explicit (send). */
  permissionLevel: 1 | 2 | 3;
  status: AgentActionStatus;
  requestPayload: unknown;
  resultPayload: unknown;
  verificationResult: unknown;
  approvedAt: string | null;
  executedAt: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** TanStack Query cache key for the agent-actions list. */
export const AGENT_ACTIONS_QUERY_KEY = ['agent-actions'] as const;

/**
 * `requestPayload` of a `create_calendar_event` action: the meeting the
 * agent proposes (BE-032/BE-036). Absent fields mean the proposal didn't
 * carry them — the flow degrades honestly rather than inventing values.
 */
export interface CalendarEventRequest {
  title?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  description?: string;
}

/**
 * `requestPayload` of a `draft_email` action: the suggested reply. Rendered
 * verbatim (AI-generated, language inferred by the backend) — never through
 * t().
 */
export interface EmailDraftRequest {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
}

/** Lists the signed-in user's agent actions (optionally by status). */
export function useAgentActions(status?: AgentActionStatusFilter) {
  const path = status === undefined ? '/actions' : `/actions?status=${encodeURIComponent(status)}`;
  return useQuery({
    queryKey: [...AGENT_ACTIONS_QUERY_KEY, status ?? 'all'],
    queryFn: () => apiFetch<{ actions: AgentActionWire[] }>(path),
    retry: false,
  });
}

/**
 * Newest action of `actionType` for one discovery (list is createdAt-desc,
 * so the first match wins). Pure — exported for tests and selectors.
 */
export function selectLatestDiscoveryAction(
  actions: AgentActionWire[],
  discoveryId: string,
  actionType: AgentActionType,
): AgentActionWire | undefined {
  return actions.find((a) => a.actionType === actionType && a.discoveryId === discoveryId);
}

/**
 * Approves an awaiting action. The returned row carries the transition
 * outcome: `approved` (consent recorded — caller drives the route-executed
 * step, e.g. POST /calendar/events), `verified` (server executed it), or
 * `failed` (execution error is the action's recorded outcome, in
 * `failureReason`).
 */
export function useApproveAgentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AgentActionWire>(`/actions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY }),
  });
}

/** Rejects (cancels) an awaiting action — 204, no body. */
export function useRejectAgentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/actions/${id}/reject`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY }),
  });
}
