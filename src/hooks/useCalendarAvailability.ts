import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Calendar availability (FE-021) against Inbox-api BE-033
 * (`GET /calendar/availability`). The route answers with BUSY intervals
 * (`{ busy: [{ start, end }] }`) — free time is derived client-side by
 * {@link computeFreeSlots}.
 */

/** Wire shape of one busy interval (ISO-8601 datetimes). */
export interface BusyInterval {
  start: string;
  end: string;
}

/** A bookable free window (Date objects, local time). */
export interface FreeSlot {
  start: Date;
  end: Date;
}

/** Overlap test: two half-open intervals [s, e) intersect when each starts before the other ends. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Pure: hour-aligned slots of `slotMinutes` between `windowStart` and
 * `windowEnd` (exclusive of a trailing partial slot) that do not overlap any
 * busy interval. Unsorted/overlapping busy input is tolerated; intervals
 * outside the window are ignored; unparseable intervals are skipped with a
 * console error (they can't be trusted to block or free a slot).
 */
export function computeFreeSlots(
  busy: BusyInterval[],
  windowStart: Date,
  windowEnd: Date,
  slotMinutes = 60,
): FreeSlot[] {
  const slotMs = slotMinutes * 60_000;
  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  const busyRanges: Array<{ start: number; end: number }> = [];
  for (const interval of busy) {
    const start = new Date(interval.start).getTime();
    const end = new Date(interval.end).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      console.error('[computeFreeSlots] ignoring malformed busy interval', interval);
      continue;
    }
    busyRanges.push({ start, end });
  }

  const slots: FreeSlot[] = [];
  for (let start = windowStartMs; start + slotMs <= windowEndMs; start += slotMs) {
    const end = start + slotMs;
    const isBusy = busyRanges.some((b) => overlaps(start, end, b.start, b.end));
    if (!isBusy) {
      slots.push({ start: new Date(start), end: new Date(end) });
    }
  }
  return slots;
}

/**
 * Busy intervals for a start/end range. Disabled until the caller knows
 * Calendar is connected (the route answers 400 `calendar_not_connected`
 * otherwise) and `start`/`end` are valid ISO strings.
 */
export function useCalendarAvailability(start: string | null, end: string | null, enabled: boolean) {
  const ready = enabled && start !== null && end !== null;
  return useQuery({
    queryKey: ['calendar', 'availability', start, end],
    queryFn: () =>
      apiFetch<{ busy: BusyInterval[] }>(
        `/calendar/availability?start=${encodeURIComponent(start ?? '')}&end=${encodeURIComponent(end ?? '')}`,
      ),
    enabled: ready,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}