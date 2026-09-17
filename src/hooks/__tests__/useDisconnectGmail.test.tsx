import { cleanup, renderHook, waitFor, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useDisconnectGmail } from '../useDisconnectGmail';
import { GMAIL_STATUS_QUERY_KEY } from '../useGmailStatus';
import { CALENDAR_STATUS_QUERY_KEY } from '../useCalendarStatus';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Renders the router's current pathname — the navigate('/onboarding') target. */
const PathProbe = () => {
  const location = useLocation();
  return <div>probe:{location.pathname}</div>;
};

describe('useDisconnectGmail', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/settings']}>
        <Routes>
          <Route path="/app/settings" element={children} />
          <Route path="/onboarding" element={<PathProbe />} />
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

  it('DELETEs the real backend endpoint /account/disconnect/gmail', async () => {
    mockApiFetch.mockResolvedValueOnce({ disconnected: true });

    const { result } = renderHook(() => useDisconnectGmail(), { wrapper });

    await result.current.mutateAsync();
    expect(mockApiFetch).toHaveBeenCalledWith('/account/disconnect/gmail', {
      method: 'DELETE',
    });
  });

  it('invalidates both status caches — the backend clears Calendar along with Gmail', async () => {
    mockApiFetch.mockResolvedValueOnce({ disconnected: true });

    const { result } = renderHook(() => useDisconnectGmail(), { wrapper });

    await waitFor(() => result.current.mutateAsync());

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: GMAIL_STATUS_QUERY_KEY });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CALENDAR_STATUS_QUERY_KEY });
    });
  });

  it('navigates to /onboarding on success — the user must reconnect', async () => {
    mockApiFetch.mockResolvedValue({ disconnected: true });

    const { result } = renderHook(() => useDisconnectGmail(), { wrapper });

    await waitFor(() => result.current.mutateAsync());

    await screen.findByText('probe:/onboarding');
  });

  it('surfaces the error and does not navigate when the disconnect fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));

    const { result } = renderHook(() => useDisconnectGmail(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow('backend down');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(screen.queryByText('probe:/onboarding')).toBeNull();
  });
});
