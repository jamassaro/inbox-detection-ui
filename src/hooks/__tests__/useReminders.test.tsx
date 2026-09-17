import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/apiClient';
import {
  REMINDERS_QUERY_KEY,
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useRescheduleReminder,
  type ReminderWire,
} from '../useReminders';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireReminder = (overrides: Partial<ReminderWire> = {}): ReminderWire => ({
  id: 'rem_1',
  userId: 'usr_1',
  discoveryId: 'disc_1',
  title: 'Netflix renews at $15.49',
  description: null,
  remindAt: '2026-09-20T09:00:00.000Z',
  status: 'pending',
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

/** Fresh client per test — no cross-test cache bleed. */
const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useReminders', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  it('fetches the pending list and filters to one discovery client-side', async () => {
    const other = wireReminder({ id: 'rem_2', discoveryId: 'disc_2' });
    mockApiFetch.mockResolvedValue({ reminders: [wireReminder(), other] });

    const { result } = renderHook(() => useReminders('disc_1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(mockApiFetch).toHaveBeenCalledWith('/reminders?status=pending');
    expect(result.current.reminders).toEqual([wireReminder()]);
  });

  it('returns every pending reminder when no discoveryId is given', async () => {
    const rows = [wireReminder(), wireReminder({ id: 'rem_2', discoveryId: 'disc_2' })];
    mockApiFetch.mockResolvedValue({ reminders: rows });

    const { result } = renderHook(() => useReminders(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.reminders).toEqual(rows);
  });

  it('surfaces the list error instead of swallowing it', async () => {
    mockApiFetch.mockRejectedValue(new Error('list unavailable'));

    const { result } = renderHook(() => useReminders('disc_1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.reminders).toEqual([]);
  });
});

describe('useCreateReminder', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  it('POSTs the wire shape and invalidates the reminders list', async () => {
    // Seed an active list query so the invalidation has something to refetch.
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/reminders?status=pending') {
        return Promise.resolve({ reminders: [wireReminder()] });
      }
      if (path === '/reminders') {
        return Promise.resolve({
          id: 'rem_2',
          title: 'New',
          remindAt: '2026-09-21T09:00:00.000Z',
          status: 'pending',
        });
      }
      return Promise.reject(new Error(`unexpected path: ${String(path)}`));
    });

    const wrapper = makeWrapper();
    const list = renderHook(() => useReminders('disc_1'), { wrapper });
    const create = renderHook(() => useCreateReminder(), { wrapper });

    await waitFor(() => expect(list.result.current.isPending).toBe(false));
    const callsBefore = mockApiFetch.mock.calls.length;

    create.result.current.mutate({
      discoveryId: 'disc_1',
      title: 'New',
      remindAt: '2026-09-21T09:00:00.000Z',
    });

    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/reminders', {
      method: 'POST',
      body: JSON.stringify({
        discoveryId: 'disc_1',
        title: 'New',
        remindAt: '2026-09-21T09:00:00.000Z',
      }),
    });
    // Invalidation refetches the active list — the new row becomes visible.
    await waitFor(() => expect(mockApiFetch.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('propagates the backend error (e.g. Free 402) to the mutation', async () => {
    mockApiFetch.mockRejectedValue(new Error('402'));

    const { result } = renderHook(() => useCreateReminder(), { wrapper: makeWrapper() });
    result.current.mutate({
      discoveryId: 'disc_1',
      title: 'New',
      remindAt: '2026-09-21T09:00:00.000Z',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRescheduleReminder', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  it('PATCHes the new remindAt on the reminder row', async () => {
    mockApiFetch.mockResolvedValue(wireReminder({ remindAt: '2026-09-25T09:00:00.000Z' }));

    const { result } = renderHook(() => useRescheduleReminder(), { wrapper: makeWrapper() });
    result.current.mutate({ id: 'rem_1', remindAt: '2026-09-25T09:00:00.000Z' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', {
      method: 'PATCH',
      body: JSON.stringify({ remindAt: '2026-09-25T09:00:00.000Z' }),
    });
  });
});

describe('useDeleteReminder', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  it('DELETEs the reminder (204, no body) and invalidates the list', async () => {
    let cancelled = false;
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/reminders?status=pending') {
        return Promise.resolve({ reminders: cancelled ? [] : [wireReminder()] });
      }
      if (path === '/reminders/rem_1') {
        cancelled = true;
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected path: ${String(path)}`));
    });

    const wrapper = makeWrapper();
    const list = renderHook(() => useReminders(), { wrapper });
    const del = renderHook(() => useDeleteReminder(), { wrapper });

    await waitFor(() => expect(list.result.current.isPending).toBe(false));
    const callsBefore = mockApiFetch.mock.calls.length;

    del.result.current.mutate('rem_1');

    await waitFor(() => expect(del.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', { method: 'DELETE' });
    await waitFor(() => expect(mockApiFetch.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(list.result.current.reminders).toEqual([]));
  });
});

describe('REMINDERS_QUERY_KEY', () => {
  it('is the stable list cache key', () => {
    expect(REMINDERS_QUERY_KEY).toEqual(['reminders']);
  });
});
