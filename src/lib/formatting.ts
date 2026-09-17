/**
 * Locale-aware formatting helpers. All user-visible dates, numbers, and
 * currency must go through these (AGENTS.md Internationalization rules).
 * Currency is an explicit argument — never derived from the locale.
 */

const toDate = (date: Date | string): Date =>
  typeof date === 'string' ? new Date(date) : date;

export function formatDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(toDate(date));
}

export function formatRelativeDate(date: Date | string, locale: string): string {
  const target = toDate(date);
  const now = new Date();

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(dayDiff) < 1) {
    const diffMs = target.getTime() - now.getTime();
    const minutes = Math.round(diffMs / 60_000);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    return rtf.format(Math.round(minutes / 60), 'hour');
  }
  if (Math.abs(dayDiff) < 30) return rtf.format(dayDiff, 'day');
  if (Math.abs(dayDiff) < 365) return rtf.format(Math.round(dayDiff / 30), 'month');
  return rtf.format(Math.round(dayDiff / 365), 'year');
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }).format(
    amount,
  );
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatMeetingTime(date: Date, locale: string, tz?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  }).format(date);
}
