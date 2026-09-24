import { describe, expect, it } from 'vitest';
import {
  filterDiscoveries,
  isEndingSoon,
  isNewDiscovery,
  matchesDiscoveryFilter,
  matchesDiscoverySearch,
} from '../discoveryFilters';
import type { Discovery } from '../../types';

const HOUR = 3_600_000;

const discovery = (overrides: Partial<Discovery> = {}): Discovery => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'Netflix renews soon',
  summary: 'Standard plan renewal.',
  company: 'Netflix',
  companyInitials: 'N',
  amount: 15.49,
  currency: 'USD',
  date: new Date(Date.now() + 3 * 24 * HOUR).toISOString(),
  createdAt: new Date(Date.now() - 24 * HOUR).toISOString(),
  importance: 'high',
  status: 'new',
  locked: false,
  availableActions: ['dismiss'],
  callToActions: null,
  ...overrides,
});

describe('matchesDiscoveryFilter', () => {
  it('passes everything on the all tab', () => {
    expect(matchesDiscoveryFilter(discovery({ date: undefined, createdAt: undefined }), 'all')).toBe(true);
  });

  it('marks rows ending within 7 days (or already passed) as ending soon', () => {
    expect(matchesDiscoveryFilter(discovery(), 'ending-soon')).toBe(true);
    expect(matchesDiscoveryFilter(discovery({ date: new Date(Date.now() + 8 * 24 * HOUR).toISOString() }), 'ending-soon')).toBe(false);
  });

  it('marks rows created within 7 days as new, failing closed without createdAt', () => {
    expect(matchesDiscoveryFilter(discovery(), 'new')).toBe(true);
    expect(matchesDiscoveryFilter(discovery({ createdAt: new Date(Date.now() - 8 * 24 * HOUR).toISOString() }), 'new')).toBe(false);
    expect(matchesDiscoveryFilter(discovery({ createdAt: undefined }), 'new')).toBe(false);
  });

  it('fails closed on the saved tab — the backend has no saved concept', () => {
    expect(matchesDiscoveryFilter(discovery(), 'saved')).toBe(false);
  });
});

describe('isEndingSoon', () => {
  it('is false when there is no parseable date', () => {
    expect(isEndingSoon(discovery({ date: undefined }))).toBe(false);
    expect(isEndingSoon(discovery({ date: 'not-a-date' }))).toBe(false);
  });
});

describe('isNewDiscovery', () => {
  it('is false when there is no createdAt (fails closed, no fabricated default)', () => {
    expect(isNewDiscovery(discovery({ createdAt: undefined }))).toBe(false);
    expect(isNewDiscovery(discovery({ createdAt: 'not-a-date' }))).toBe(false);
  });
});

describe('matchesDiscoverySearch', () => {
  it('matches company or title case-insensitively and passes empty queries', () => {
    expect(matchesDiscoverySearch(discovery(), 'netf')).toBe(true);
    expect(matchesDiscoverySearch(discovery(), 'RENEWS')).toBe(true);
    expect(matchesDiscoverySearch(discovery(), 'spotify')).toBe(false);
    expect(matchesDiscoverySearch(discovery(), '   ')).toBe(true);
  });
});

describe('filterDiscoveries', () => {
  it('applies the filter and search in one pass', () => {
    const rows = [
      discovery({ id: 'soon', company: 'Netflix' }),
      discovery({ id: 'later', company: 'Spotify', date: new Date(Date.now() + 30 * 24 * HOUR).toISOString() }),
      discovery({ id: 'other', company: 'Hulu', date: new Date(Date.now() + 2 * 24 * HOUR).toISOString() }),
    ];
    expect(filterDiscoveries(rows, 'ending-soon', '').map((d) => d.id)).toEqual(['soon', 'other']);
    expect(filterDiscoveries(rows, 'all', 'spot').map((d) => d.id)).toEqual(['later']);
    expect(filterDiscoveries(rows, 'ending-soon', 'spot')).toEqual([]);
  });
});
