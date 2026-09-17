import type { CalendarEventRequest } from '../hooks/useAgentAction';
import { computeFreeSlots } from '../hooks/useCalendarAvailability';
import type { BusyInterval } from '../hooks/useCalendarAvailability';

/** A selectable slot in the proposal list — the requester's proposed time is flagged. */
export interface ProposalSlot {
  start: Date;
  end: Date;
  suggested: boolean;
}

/** Booking hold applied when the proposal carries no explicit end. */
const DEFAULT_SLOT_MINUTES = 60;

/** Local-time day window scanned for alternative free slots. */
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;

/**
 * Validates the action's `requestPayload` into a concrete proposed slot.
 * Returns null when the proposal carries no usable start. A missing/invalid
 * end falls back to a {@link DEFAULT_SLOT_MINUTES} hold — a booking needs a
 * duration, and that is the slot grid's granularity (a UI default, not
 * invented payload data).
 */
export function parseProposedSlot(payload: CalendarEventRequest): { start: Date; end: Date } | null {
  const start = new Date(payload.start ?? '');
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(payload.end ?? '');
  if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
    return { start, end };
  }
  return { start, end: new Date(start.getTime() + DEFAULT_SLOT_MINUTES * 60_000) };
}

/** Local-time day window scanned for alternative free slots. */
export function availabilityWindow(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(WINDOW_START_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(WINDOW_END_HOUR, 0, 0, 0);
  return { start, end };
}

function overlapsBusy(slot: { start: Date; end: Date }, busy: BusyInterval[]): boolean {
  return busy.some((interval) => {
    const bStart = new Date(interval.start).getTime();
    const bEnd = new Date(interval.end).getTime();
    return slot.start.getTime() < bEnd && bStart < slot.end.getTime();
  });
}

/**
 * Pure: the proposal's selectable slots — free hour-aligned slots for the
 * proposed day plus the proposed time itself (flagged "suggested"), offered
 * only when it does not overlap a busy interval. Sorted by start.
 */
export function buildProposalSlots(
  payload: CalendarEventRequest,
  busy: BusyInterval[],
): ProposalSlot[] {
  const proposed = parseProposedSlot(payload);
  if (!proposed) return [];

  const range = availabilityWindow(proposed.start);
  const slots = new Map<number, ProposalSlot>();
  for (const free of computeFreeSlots(busy, range.start, range.end, DEFAULT_SLOT_MINUTES)) {
    slots.set(free.start.getTime(), { ...free, suggested: false });
  }
  if (!overlapsBusy(proposed, busy)) {
    // The proposed slot wins over any hour-aligned duplicate at the same start.
    slots.set(proposed.start.getTime(), { ...proposed, suggested: true });
  }
  return [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
