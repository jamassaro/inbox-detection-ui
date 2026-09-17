/**
 * Pure extraction/derivation for AgentAction payloads (FE-021). The
 * requestPayload/resultPayload columns arrive PARSED but untyped (raw
 * `unknown`) — these helpers narrow them defensively so malformed AI output
 * degrades to "no proposal" instead of crashing a flow.
 */

import type { CalendarEventRequest, EmailDraftRequest } from '../hooks/useAgentAction';
import type { BusyInterval } from '../hooks/useCalendarAvailability';

/** Narrow `unknown` to a record (or null). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The `create_calendar_event` action's proposed meeting, when well-formed. */
export function extractCalendarRequest(payload: unknown): CalendarEventRequest | null {
  const record = asRecord(payload);
  if (record === null) return null;
  const request: CalendarEventRequest = {
    title: typeof record.title === 'string' ? record.title : undefined,
    start: typeof record.start === 'string' ? record.start : undefined,
    end: typeof record.end === 'string' ? record.end : undefined,
    attendees: Array.isArray(record.attendees)
      ? record.attendees.filter((a): a is string => typeof a === 'string')
      : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
  };
  return request.start !== undefined || request.end !== undefined ? request : null;
}

/** The `draft_email` action's suggested reply, when well-formed. */
export function extractEmailDraft(payload: unknown): EmailDraftRequest | null {
  const record = asRecord(payload);
  if (record === null) return null;
  const draft: EmailDraftRequest = {
    to: typeof record.to === 'string' ? record.to : undefined,
    subject: typeof record.subject === 'string' ? record.subject : undefined,
    body: typeof record.body === 'string' ? record.body : undefined,
    threadId: typeof record.threadId === 'string' ? record.threadId : undefined,
  };
  return draft.to !== undefined || draft.subject !== undefined || draft.body !== undefined
    ? draft
    : null;
}

/** The `send_email` action's draft reference, when well-formed. */
export function extractSendDraftId(payload: unknown): string | null {
  const record = asRecord(payload);
  return record !== null && typeof record.draftId === 'string' ? record.draftId : null;
}

/**
 * Pure: `true` when the half-open slot [slot, slot+durationMs) overlaps no
 * busy interval. Unparseable busy intervals are skipped (they cannot be
 * trusted to block a slot — and the availability hook already surfaces
 * malformed input via console.error).
 */
export function isSlotFree(slot: Date, busy: BusyInterval[], durationMs = 3_600_000): boolean {
  const start = slot.getTime();
  const end = start + durationMs;
  return !busy.some((interval) => {
    const busyStart = new Date(interval.start).getTime();
    const busyEnd = new Date(interval.end).getTime();
    if (Number.isNaN(busyStart) || Number.isNaN(busyEnd)) return false;
    return start < busyEnd && busyStart < end;
  });
}
