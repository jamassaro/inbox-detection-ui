import { describe, expect, it } from 'vitest';
import {
  computeRemindAt,
  defaultCustomInputs,
  minCustomDate,
} from '../reminderSchedule';

const DISCOVERY_DATE = '2026-09-24'; // Thursday, in the TZ the test runner uses.
const BASE = new Date(2026, 8, 17, 15, 30); // Sep 17 2026, 15:30 local.

describe('computeRemindAt', () => {
  it('schedules tomorrow at 09:00 local time', () => {
    const at = computeRemindAt({ kind: 'tomorrow' }, undefined, BASE);
    expect(at).not.toBeNull();
    const d = at as Date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('anchors daysBefore at 09:00 on the discovery date', () => {
    const at = computeRemindAt({ kind: 'days_before', days: 3 }, DISCOVERY_DATE, BASE);
    expect(at).not.toBeNull();
    const d = at as Date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(9);
  });

  it('returns null for daysBefore without a discovery date', () => {
    expect(computeRemindAt({ kind: 'days_before', days: 2 }, undefined, BASE)).toBeNull();
  });

  it('returns null for a malformed discovery date', () => {
    expect(computeRemindAt({ kind: 'days_before', days: 2 }, 'not-a-date', BASE)).toBeNull();
  });

  it('combines a custom date and time', () => {
    const at = computeRemindAt({ kind: 'custom', date: '2026-09-20', time: '14:45' }, undefined, BASE);
    expect(at).not.toBeNull();
    const d = at as Date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(45);
  });

  it('returns null for a custom selection missing its date or time', () => {
    expect(computeRemindAt({ kind: 'custom', date: '', time: '10:00' }, undefined, BASE)).toBeNull();
    expect(computeRemindAt({ kind: 'custom', date: '2026-09-20', time: '' }, undefined, BASE)).toBeNull();
  });

  it('returns null for an invalid custom date', () => {
    expect(computeRemindAt({ kind: 'custom', date: '2026-13-45', time: '10:00' }, undefined, BASE)).toBeNull();
  });
});

describe('defaultCustomInputs', () => {
  it('prefills today at 09:00 when the discovery has no date', () => {
    const inputs = defaultCustomInputs(undefined, BASE);
    expect(inputs.date).toBe('2026-09-17');
    expect(inputs.time).toBe('09:00');
  });

  it('prefills the discovery date when known', () => {
    const inputs = defaultCustomInputs(DISCOVERY_DATE, BASE);
    expect(inputs.date).toBe('2026-09-24');
    expect(inputs.time).toBe('09:00');
  });
});

describe('minCustomDate', () => {
  it('is today, formatted for a date input', () => {
    expect(minCustomDate(BASE)).toBe('2026-09-17');
  });
});
