/**
 * sessionStorage contract for the contextual Calendar OAuth return (FE-021).
 * Deliberately separate from the billing upgradeContext key: the connect
 * flow resumes a discovery, not a checkout.
 */

export const CALENDAR_RETURN_CONTEXT_KEY = 'calendar-return-context';

/** Shape stored under {@link CALENDAR_RETURN_CONTEXT_KEY} before the OAuth redirect. */
export interface CalendarReturnContext {
  discoveryId: string;
  returnPath: string;
}

/**
 * Reads (and does NOT clear) the pending Calendar OAuth return context.
 * Invalid or foreign JSON yields null, never a throw. The caller clears the
 * key once it has acted on the return.
 */
export function readCalendarReturnContext(): CalendarReturnContext | null {
  try {
    const raw = window.sessionStorage.getItem(CALENDAR_RETURN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { discoveryId?: unknown }).discoveryId === 'string' &&
      typeof (parsed as { returnPath?: unknown }).returnPath === 'string'
    ) {
      return parsed as CalendarReturnContext;
    }
    return null;
  } catch {
    // Corrupted storage must never block the discovery page from rendering.
    return null;
  }
}

/** Persists the return context the OAuth callback will land back on. */
export function storeCalendarReturnContext(context: CalendarReturnContext): void {
  window.sessionStorage.setItem(CALENDAR_RETURN_CONTEXT_KEY, JSON.stringify(context));
}

/** Drops the return context once consumed (or abandoned). */
export function clearCalendarReturnContext(): void {
  window.sessionStorage.removeItem(CALENDAR_RETURN_CONTEXT_KEY);
}
