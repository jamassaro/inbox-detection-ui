import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  REMINDERS_QUERY_KEY,
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useRescheduleReminder,
} from '../useReminders';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireReminder = (overrides: Partial<{ id: string; discoveryId: string | null }> = {}) => ({
  id: overrides.id ?? 'rem_1',
  userId: 'usr_1',
  discoveryId: overrides.discoveryId ?? 'disc_1',
  title: 'Call the vendor',
  description: null,
  remindAt: '2026-09-20T09:00:00.000Z',
  status: 'pending' as const,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
});

describe('useReminders', () => {
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

  it('fetches pending reminders from the verified list route', async () => {
    mockApiFetch.mockResolvedValueOnce({ reminders: [wireReminder()] });

    const { result } = renderHook(() => useReminders(), { wrapper });

    await waitFor(() => expect(result.current.reminders).toHaveLength(1));
    expect(mockApiFetch).toHaveBeenCalledWith('/reminders?status=pending');
    expect(result.current.reminders[0].title).toBe('Call the vendor');
  });

  it('filters client-side by discoveryId (no server param exists)', async () => {
    mockApiFetch.mockResolvedValueOnce({
      reminders: [wireReminder({ id: 'a', discoveryId: 'disc_1' }), wireReminder({ id: 'b', discoveryId: 'disc_2' })],
    });

    const { result } = renderHook(() => useReminders('disc_2'), { wrapper });

    await waitFor(() => expect(result.current.reminders).toHaveLength(1));
    expect(result.current.reminders[0].id).toBe('b');
  });

  it('surfaces list errors without retrying', async () => {
    mockApiFetch.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useReminders(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateReminder', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
    queryClient.setQueryData(REMINDERS_QUERY_KEY, { reminders: [wireReminder()] });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('POSTs the create body and invalidates the list cache', async () => {
    mockApiFetch.mockResolvedValueOnce({ id: 'rem_new', title: 'x', remindAt: '2026-09-21T09:00:00.000Z', status: 'pending' });

    const { result } = renderHook(() => useCreateReminder(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ discoveryId: 'disc_1', title: 'x', remindAt: '2026-09-21T09:00:00.000Z' }),
    );

    expect(mockApiFetch).toHaveBeenCalledWith('/reminders', {
      method: 'POST',
      body: JSON.stringify({ discoveryId: 'disc_1', title: 'x', remindAt: '2026-09-21T09:00:00.000Z' }),
    });
    await waitFor(() => expect(queryClient.getQueryState(REMINDERS_QUERY_KEY)?.isInvalidated).toBe(true));
  });
});

describe('useRescheduleReminder', () => {
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

  it('PATCHes only the remindAt field', async () => {
    mockApiFetch.mockResolvedValueOnce(wireReminder());

    const { result } = renderHook(() => useRescheduleReminder(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 'rem_1', remindAt: '2026-09-22T09:00:00.000Z' }));

    expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', {
      method: 'PATCH',
      body: JSON.stringify({ remindAt: '2026-09-22T09:00:00.000Z' }),
    });
  });
});

describe('useDeleteReminder', () => {
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

  it('DELETEs the reminder row', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteReminder(), { wrapper });
    await act(() => result.current.mutateAsync('rem_1'));

    expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', { method: 'DELETE' });
  });
});
