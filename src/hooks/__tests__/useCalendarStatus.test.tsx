import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  startCalendarConnect,
  useCalendarStatus,
} from '../useCalendarStatus';
import { apiFetch } from '../../lib/apiClient';
import { stubWindowLocation } from '../../test-utils';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

describe('useCalendarStatus', () => {
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

  it('maps the calendar row of GET /account/connections onto { connected }', async () => {
    mockApiFetch.mockResolvedValueOnce({
      gmail: { connected: true, email: 'ada@example.com' },
      calendar: { connected: true },
      gmailCompose: { enabled: false },
    });

    const { result } = renderHook(() => useCalendarStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ connected: true }));
    expect(mockApiFetch).toHaveBeenCalledWith('/account/connections');
  });

  it('exposes a disconnected calendar', async () => {
    mockApiFetch.mockResolvedValueOnce({
      gmail: { connected: true, email: 'ada@example.com' },
      calendar: { connected: false },
      gmailCompose: { enabled: false },
    });

    const { result } = renderHook(() => useCalendarStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ connected: false }));
  });

  it('surfaces a failed status check as an error without retrying', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));

    const { result } = renderHook(() => useCalendarStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('startCalendarConnect', () => {
  let location: ReturnType<typeof stubWindowLocation>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    location = stubWindowLocation();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    location.restore();
  });

  it('full-page-redirects to the consent URL from GET /calendar/connect', async () => {
    mockApiFetch.mockResolvedValueOnce({ authUrl: 'https://accounts.google.test/consent' });

    await expect(startCalendarConnect()).resolves.toBe(true);
    expect(location.href).toBe('https://accounts.google.test/consent');
  });

  it('returns false without navigating when the consent URL request fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('backend down'));

    await expect(startCalendarConnect()).resolves.toBe(false);
    expect(location.href).toBe('');
    expect(consoleError).toHaveBeenCalled();
  });
});
