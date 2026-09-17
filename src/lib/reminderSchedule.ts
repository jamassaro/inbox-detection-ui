/**
 * Pure reminder-time computation (FE-020). The modal collects a
 * {@link ReminderSelection}; this module turns it into the ISO datetime the
 * backend stores. All arithmetic is local time — the backend persists ISO
 * strings and workers do their own timezone handling.
 */

/** How the user chose to be reminded. */
export type ReminderSelection =
  | { kind: 'tomorrow' }
  | { kind: 'days_before'; days: number }
  | { kind: 'custom'; /** Local date, YYYY-MM-DD. */ date: string; /** Local time, HH:mm. */ time: string };

/** Hour the shortcut options schedule for (9 AM local). */
const DEFAULT_HOUR = 9;

/** Local YYYY-MM-DD of `date` shifted by `dayOffset`. */
function localDateInput(date: Date, dayOffset = 0): string {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + dayOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

/**
 * Pure: the Date a selection resolves to, or `null` when it cannot be
 * computed (custom inputs empty/invalid, days-before without a discovery
 * date). Never throws.
 */
export function computeRemindAt(
  selection: ReminderSelection,
  discoveryDate: string | undefined,
  now: Date = new Date(),
): Date | null {
  switch (selection.kind) {
    case 'tomorrow': {
      const at = new Date(now);
      at.setDate(at.getDate() + 1);
      at.setHours(DEFAULT_HOUR, 0, 0, 0);
      return at;
    }
    case 'days_before': {
      if (!discoveryDate) return null;
      const anchor = new Date(`${discoveryDate}T${String(DEFAULT_HOUR).padStart(2, '0')}:00`);
      if (Number.isNaN(anchor.getTime())) return null;
      anchor.setDate(anchor.getDate() - selection.days);
      return anchor;
    }
    case 'custom': {
      if (selection.date === '' || selection.time === '') return null;
      const at = new Date(`${selection.date}T${selection.time}`);
      return Number.isNaN(at.getTime()) ? null : at;
    }
  }
}

/** Pure: default custom-input values (discovery date if known, else today; 09:00). */
export function defaultCustomInputs(discoveryDate: string | undefined, now: Date = new Date()): {
  date: string;
  time: string;
} {
  return {
    date: discoveryDate ?? localDateInput(now),
    time: `${String(DEFAULT_HOUR).padStart(2, '0')}:00`,
  };
}

/** Pure: min value for the custom date input (today, local). */
export function minCustomDate(now: Date = new Date()): string {
  return localDateInput(now);
}
