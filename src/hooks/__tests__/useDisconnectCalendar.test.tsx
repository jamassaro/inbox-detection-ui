import { cleanup, renderHook, waitFor, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useDisconnectCalendar } from '../useDisconnectCalendar';
import { CALENDAR_STATUS_QUERY_KEY } from '../useCalendarStatus';
import { GMAIL_STATUS_QUERY_KEY } from '../useGmailStatus';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Renders the router's current pathname — the stay-on-page assertion target. */
const PathProbe = () => {
  const location = useLocation();
  return <div>probe:{location.pathname}</div>;
};

describe('useDisconnectCalendar', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/settings']}>
        <Routes>
          <Route path="/app/settings" element={children} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('DELETEs the real backend endpoint /account/disconnect/calendar', async () => {
    mockApiFetch.mockResolvedValueOnce({ disconnected: true });

    const { result } = renderHook(() => useDisconnectCalendar(), { wrapper });

    await waitFor(() => result.current.mutateAsync());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/account/disconnect/calendar', {
      method: 'DELETE',
    });
  });

  it('invalidates the calendar status cache but leaves Gmail status alone', async () => {
    mockApiFetch.mockResolvedValueOnce({ disconnected: true });

    const { result } = renderHook(() => useDisconnectCalendar(), { wrapper });

    await waitFor(() => result.current.mutateAsync());

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CALENDAR_STATUS_QUERY_KEY }),
    );
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: GMAIL_STATUS_QUERY_KEY });
  });

  it('stays on the settings page — no navigation on success', async () => {
    mockApiFetch.mockResolvedValue({ disconnected: true });

    const { result } = renderHook(() => useDisconnectCalendar(), { wrapper });

    await waitFor(() => result.current.mutateAsync());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hook never navigates; the caller is still mounted on /app/settings.
    expect(screen.queryByText('probe:/app/settings')).toBeNull();
    expect(screen.queryByText('probe:/onboarding')).toBeNull();
  });

  it('surfaces the error when the disconnect fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));

    const { result } = renderHook(() => useDisconnectCalendar(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow('backend down');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
