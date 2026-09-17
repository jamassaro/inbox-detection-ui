import { describe, expect, it } from 'vitest';
import {
  extractCalendarRequest,
  extractEmailDraft,
  extractSendDraftId,
  isSlotFree,
} from '../agentProposal';

describe('extractCalendarRequest', () => {
  it('reads the calendar fields from the request payload', () => {
    const payload = {
      title: 'Renewal call',
      start: '2026-09-18T15:00:00.000Z',
      end: '2026-09-18T16:00:00.000Z',
      attendees: ['a@example.com'],
      description: 'Discuss terms',
    };
    expect(extractCalendarRequest(payload)).toEqual(payload);
  });

  it('returns null for missing or malformed payloads', () => {
    expect(extractCalendarRequest(undefined)).toBeNull();
    expect(extractCalendarRequest(null)).toBeNull();
    expect(extractCalendarRequest('nope')).toBeNull();
    expect(extractCalendarRequest(42)).toBeNull();
  });
});

describe('extractEmailDraft', () => {
  it('reads the draft fields from the request payload', () => {
    const payload = {
      to: 'vendor@example.com',
      subject: 'Re: renewal',
      body: 'Hello',
      threadId: 'th_1',
    };
    expect(extractEmailDraft(payload)).toEqual(payload);
  });

  it('returns null for missing or malformed payloads', () => {
    expect(extractEmailDraft(undefined)).toBeNull();
    expect(extractEmailDraft(null)).toBeNull();
    expect(extractEmailDraft([])).toBeNull();
  });
});

describe('extractSendDraftId', () => {
  it('reads the draftId from a send payload', () => {
    expect(extractSendDraftId({ draftId: 'd-1' })).toBe('d-1');
  });

  it('returns null when the payload does not name a draft', () => {
    expect(extractSendDraftId({})).toBeNull();
    expect(extractSendDraftId(undefined)).toBeNull();
    expect(extractSendDraftId('x')).toBeNull();
  });
});

describe('isSlotFree', () => {
  const slot = () => new Date('2026-09-18T15:00:00.000Z');

  it('is free when the busy list does not overlap', () => {
    const busy = [
      { start: '2026-09-18T16:00:00.000Z', end: '2026-09-18T17:00:00.000Z' },
      { start: '2026-09-18T14:00:00.000Z', end: '2026-09-18T15:00:00.000Z' },
    ];
    expect(isSlotFree(slot(), busy)).toBe(true);
  });

  it('is busy when an interval overlaps the slot', () => {
    const busy = [{ start: '2026-09-18T14:30:00.000Z', end: '2026-09-18T15:30:00.000Z' }];
    expect(isSlotFree(slot(), busy)).toBe(false);
  });

  it('treats a slot inside a busy interval as busy', () => {
    const busy = [{ start: '2026-09-18T00:00:00.000Z', end: '2026-09-19T00:00:00.000Z' }];
    expect(isSlotFree(slot(), busy)).toBe(false);
  });

  it('skips malformed busy entries instead of throwing', () => {
    const busy = [
      { start: 'garbage', end: '2026-09-18T17:00:00.000Z' },
      { start: '2026-09-18T16:00:00.000Z' },
    ];
    expect(isSlotFree(slot(), busy as never)).toBe(true);
  });
});
