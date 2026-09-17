import { describe, expect, it } from 'vitest';
import { getGreetingPeriod } from '../greetingHelpers';

/**
 * Boundaries of each time range (local hours): morning 00–11,
 * afternoon 12–17, evening 18–23. Uses local-tz Dates built from
 * `new Date(y, m, d, h)` so getHours() is the exact hour under test.
 */
const atHour = (hour: number): Date => new Date(2026, 8, 17, hour, 30);

describe('getGreetingPeriod', () => {
  it('returns morning for the first half of the day (00:00–11:59)', () => {
    expect(getGreetingPeriod(atHour(0))).toBe('morning');
    expect(getGreetingPeriod(atHour(8))).toBe('morning');
    expect(getGreetingPeriod(atHour(11))).toBe('morning');
  });

  it('returns afternoon for midday through early evening (12:00–17:59)', () => {
    expect(getGreetingPeriod(atHour(12))).toBe('afternoon');
    expect(getGreetingPeriod(atHour(14))).toBe('afternoon');
    expect(getGreetingPeriod(atHour(17))).toBe('afternoon');
  });

  it('returns evening from 18:00 through the end of the day', () => {
    expect(getGreetingPeriod(atHour(18))).toBe('evening');
    expect(getGreetingPeriod(atHour(21))).toBe('evening');
    expect(getGreetingPeriod(atHour(23))).toBe('evening');
  });
});
