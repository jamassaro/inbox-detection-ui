import { describe, expect, it, vi } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatMeetingTime,
  formatNumber,
  formatRelativeDate,
} from '../formatting';

describe('formatDate', () => {
  it('formats an English long-form date', () => {
    expect(formatDate(new Date('2026-09-30'), 'en')).toBe('September 30, 2026');
  });

  it('formats a Spanish long-form date', () => {
    expect(formatDate(new Date('2026-09-30'), 'es')).toBe('30 de septiembre de 2026');
  });

  it('accepts ISO date strings', () => {
    expect(formatDate('2026-09-30', 'en')).toBe('September 30, 2026');
  });
});

describe('formatCurrency', () => {
  it('formats USD for English locale', () => {
    expect(formatCurrency(59.99, 'USD', 'en')).toBe('$59.99');
  });

  it('keeps USD for Spanish locale (currency is not locale-derived)', () => {
    const result = formatCurrency(59.99, 'USD', 'es');
    expect(result).toContain('59,99');
    expect(result).toContain('US$');
  });

  it('formats EUR with locale-appropriate symbol placement', () => {
    expect(formatCurrency(10, 'EUR', 'es')).toContain('10,00');
  });
});

describe('formatNumber', () => {
  it('groups thousands by locale', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
    expect(formatNumber(12345, 'es')).toBe('12.345');
  });
});

describe('formatRelativeDate', () => {
  it('renders same-day offsets in hour units', () => {
    // Pinned clock: at 10:00, +2h stays on the same calendar day. With the
    // real clock this test failed on CI whenever the run started at or after
    // 22:00 local — now+2h crosses midnight and renders as "tomorrow".
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-17T10:00:00'));
      const inTwoHours = new Date(Date.now() + 2 * 3_600_000);
      expect(formatRelativeDate(inTwoHours, 'en')).toMatch(/in 2 hours/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders same-day past offsets in hour units', () => {
    // Pinned clock for the same reason: at 12:00, -3h stays same-day.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-17T12:00:00'));
      const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
      expect(formatRelativeDate(threeHoursAgo, 'en')).toMatch(/3 hours ago/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeDate(tomorrow, 'en')).toMatch(/tomorrow/i);
  });

  it('renders next month for ~30-day offsets', () => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 40);
    expect(formatRelativeDate(nextMonth, 'en')).toMatch(/month/i);
  });
});

describe('formatMeetingTime', () => {
  it('includes weekday, date, and time for English', () => {
    const result = formatMeetingTime(new Date('2026-09-22T14:00:00'), 'en');
    expect(result).toMatch(/Tuesday/i);
    expect(result).toMatch(/2:00/);
  });
});
