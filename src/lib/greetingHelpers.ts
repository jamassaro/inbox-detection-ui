/**
 * Time-of-day greeting derivation for the dashboard (FE-015) — pure logic,
 * split out of the component per the agentStatus/discoveryHelpers pattern so
 * it stays unit-testable and the page file stays fast-refresh clean.
 */

/** The greeting periods, matching the `common.greeting.*` i18n keys. */
export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

/**
 * Maps a Date to its greeting period by hour of day:
 * morning 00:00–11:59, afternoon 12:00–17:59, evening 18:00–23:59.
 */
export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
