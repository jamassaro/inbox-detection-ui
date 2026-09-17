import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCreateCalendarEvent } from '../useCreateCalendarEvent';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const VALID_INPUT = {
  agentActionId: 'act_1',
  title: 'Coffee chat',
  start: '2027-06-02T14:00:00.000Z',
  end: '2027-06-02T15:00:00.000Z',
  attendees: ['ada@example.com'],
  description: 'Catch up',
};

describe('useCreateCalendarEvent', () => {
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

  it('POSTs the strict create-event payload and maps the response', async () => {
    mockApiFetch.mockResolvedValueOnce({
      id: 'evt_1',
      htmlLink: 'https://calendar.google.com/evt_1',
    });

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(VALID_INPUT);
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(VALID_INPUT),
    });
    await waitFor(() =>
      expect(result.current.data).toEqual({
        id: 'evt_1',
        htmlLink: 'https://calendar.google.com/evt_1',
      }),
    );
  });

  it('omits optional attendees/description when absent', async () => {
    mockApiFetch.mockResolvedValueOnce({ id: 'evt_2' });

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        agentActionId: 'act_1',
        title: 'Coffee chat',
        start: '2027-06-02T14:00:00.000Z',
        end: '2027-06-02T15:00:00.000Z',
      });
    });

    const request = mockApiFetch.mock.calls[0][1] as { body: string };
    expect(JSON.parse(request.body)).toEqual({
      agentActionId: 'act_1',
      title: 'Coffee chat',
      start: '2027-06-02T14:00:00.000Z',
      end: '2027-06-02T15:00:00.000Z',
    });
  });

  it('surfaces 403 (own action not approved) as a mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'Action is not approved'));

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(VALID_INPUT).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it('surfaces 404 (cross-user or unknown action) as a mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(404, 'not_found', 'Action not found'));

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(VALID_INPUT).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).status).toBe(404);
  });

  it('surfaces the consumed-action 403 (second call) as a mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'Action already consumed'));

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(VALID_INPUT).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).status).toBe(403);
  });

  it('propagates the calendar_not_connected 400 with its contract body intact', async () => {
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(400, 'bad_request', 'Calendar not connected', {
        error: 'calendar_not_connected',
        connectUrl: '/calendar/connect',
      }),
    );

    const { result } = renderHook(() => useCreateCalendarEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(VALID_INPUT).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ApiError;
    expect(error.status).toBe(400);
    expect((error.body as { error: string }).error).toBe('calendar_not_connected');
  });
});
