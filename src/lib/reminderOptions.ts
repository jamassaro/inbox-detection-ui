/**
 * Pure option-building for the reminder modal (FE-020). The math lives here —
 * outside React — so it is testable without a DOM and the modal stays a
 * renderer.
 */

/** The FE-020 option kinds; the `before_*` ones exist only with a discovery date. */
export type ReminderOptionKind = 'tomorrow' | 'before_1' | 'before_3' | 'before_7' | 'custom';

/** One selectable reminder time in the modal. */
export interface ReminderOption {
  kind: ReminderOptionKind;
  /** Absolute ISO-8601 timestamp this option sends to the backend. */
  remindAt: string;
  /** i18n key under the reminders namespace (`options.*`). */
  labelKey: string;
  /** Only set for the `before_*` options — drives i18next pluralization. */
  count?: number;
  /**
   * Past timestamps are disabled, not hidden: the backend would accept them,
   * but a reminder for a moment that already happened is noise. The visible
   * absolute date explains the disabled state.
   */
  disabled: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds whole days to a Date, preserving time of day. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The reminder options for one discovery: Tomorrow plus — when the discovery
 * has an event date — the 1/3/7-days-before options computed from it (FE-020
 * agent notes: the frontend computes the absolute timestamp, the backend
 * stores it).
 */
export function buildReminderOptions(
  discoveryDate: string | undefined,
  now: Date,
): ReminderOption[] {
  const options: ReminderOption[] = [
    {
      kind: 'tomorrow',
      remindAt: addDays(now, 1).toISOString(),
      labelKey: 'options.tomorrow',
      disabled: false,
    },
  ];

  if (discoveryDate !== undefined) {
    const eventDate = new Date(discoveryDate);
    if (!Number.isNaN(eventDate.getTime())) {
      for (const days of [1, 3, 7]) {
        const remindAt = new Date(eventDate.getTime() - days * DAY_MS);
        options.push({
          kind: `before_${days}` as ReminderOptionKind,
          remindAt: remindAt.toISOString(),
          labelKey: 'options.daysBefore',
          count: days,
          disabled: remindAt.getTime() <= now.getTime(),
        });
      }
    }
  }

  return options;
}

/**
 * Combines native date + time input values (YYYY-MM-DD, HH:mm) into an ISO
 * timestamp in the user's local timezone; `null` when either part is missing
 * or the combination does not parse. FE-020 mandates native inputs for V1.
 */
export function buildCustomReminderIso(dateInput: string, timeInput: string): string | null {
  if (dateInput === '' || timeInput === '') return null;
  const parsed = new Date(`${dateInput}T${timeInput}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Splits an ISO timestamp into local date/time `<input>` values (edit prefill). */
export function toLocalInputValues(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  const pad = (value: number): string => String(value).padStart(2, '0');
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}
