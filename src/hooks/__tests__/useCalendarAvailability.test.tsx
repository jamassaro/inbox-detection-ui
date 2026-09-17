import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { computeFreeSlots, useCalendarAvailability } from '../useCalendarAvailability';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

describe('computeFreeSlots', () => {
  it('steps slots from the window start in slotMinutes increments', () => {
    const slots = computeFreeSlots(
      [],
      new Date('2026-09-18T10:30:00.000Z'),
      new Date('2026-09-18T13:30:00.000Z'),
      60,
    );
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-18T10:30:00.000Z',
      '2026-09-18T11:30:00.000Z',
      '2026-09-18T12:30:00.000Z',
    ]);
  });

  it('skips slots that overlap busy intervals', () => {
    const slots = computeFreeSlots(
      [{ start: '2026-09-18T11:30:00.000Z', end: '2026-09-18T12:30:00.000Z' }],
      new Date('2026-09-18T10:00:00.000Z'),
      new Date('2026-09-18T14:00:00.000Z'),
      60,
    );
    // 11:00-12:00 and 12:00-13:00 both overlap the busy hour and are dropped;
    // a slot whose end equals the busy start (10:00-11:00) stays free.
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-18T10:00:00.000Z',
      '2026-09-18T13:00:00.000Z',
    ]);
  });

  it('skips malformed busy entries instead of throwing', () => {
    const slots = computeFreeSlots(
      [{ start: 'garbage', end: '2026-09-18T12:00:00.000Z' }],
      new Date('2026-09-18T10:00:00.000Z'),
      new Date('2026-09-18T12:00:00.000Z'),
      60,
    );
    expect(slots).toHaveLength(2);
  });
});

describe('useCalendarAvailability', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('does not fetch while disabled', () => {
    renderHook(() => useCalendarAvailability('2026-09-18T00:00:00.000Z', '2026-09-19T00:00:00.000Z', false), {
      wrapper,
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('fetches busy intervals for the window when enabled', async () => {
    mockApiFetch.mockResolvedValueOnce({ busy: [{ start: '2026-09-18T11:00:00.000Z', end: '2026-09-18T12:00:00.000Z' }] });
    const { result } = renderHook(
      () => useCalendarAvailability('2026-09-18T00:00:00.000Z', '2026-09-19T00:00:00.000Z', true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.busy).toHaveLength(1));
    expect(mockApiFetch).toHaveBeenCalledWith('/calendar/availability?start=2026-09-18T00%3A00%3A00.000Z&end=2026-09-19T00%3A00%3A00.000Z');
  });
});
