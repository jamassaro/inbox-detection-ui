import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { GMAIL_STATUS_QUERY_KEY, startGmailConnect, useGmailStatus } from '../useGmailStatus';
import type { AccountConnectionsWire } from '../../types';
import { apiFetch } from '../../lib/apiClient';
import { stubWindowLocation } from '../../test-utils';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/**
 * The hook composes TWO real endpoints (there is no GET /gmail/status on the
 * backend — verified 2026-09-17): GET /account/connections for connected +
 * email, GET /stats for lastScan. The mock dispatches on path so both calls
 * of one queryFn resolve independently.
 */
const connectionsWire = (connected: boolean): AccountConnectionsWire => ({
  gmail: { connected, email: 'ada@example.com' },
  calendar: { connected },
  gmailCompose: { enabled: connected },
});

const stubEndpoints = (connected: boolean, lastScan: { scanDate: string } | null): void => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/account/connections') {
      return Promise.resolve(connectionsWire(connected)) as ReturnType<typeof apiFetch>;
    }
    if (path === '/stats') {
      return Promise.resolve({ lastScan }) as ReturnType<typeof apiFetch>;
    }
    return Promise.reject(new Error(`unexpected path: ${path}`)) as ReturnType<typeof apiFetch>;
  });
};

describe('useGmailStatus', () => {
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

  it('derives the connected status from /account/connections + /stats', async () => {
    stubEndpoints(true, { scanDate: '2026-09-17T10:00:00Z' });

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({
      connected: true,
      email: 'ada@example.com',
      lastSync: '2026-09-17T10:00:00Z',
    }));
    expect(mockApiFetch).toHaveBeenCalledWith('/account/connections');
    expect(mockApiFetch).toHaveBeenCalledWith('/stats');
  });

  it('exposes the disconnected payload — email and lastSync null', async () => {
    stubEndpoints(false, null);

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({
      connected: false,
      email: null,
      lastSync: null,
    }));
  });

  it('keeps the connected account email even when no scan has run yet', async () => {
    stubEndpoints(true, null);

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({
      connected: true,
      email: 'ada@example.com',
      lastSync: null,
    }));
  });

  it('stays in the loading state while the status requests never settle', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof apiFetch>);

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces a failed status check as an error instead of silently retrying', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: false — one failed queryFn attempt, immediately visible to the
    // caller. One attempt = one call to EACH of the two composed endpoints.
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('re-checks status on every mount — no cross-mount caching during onboarding', async () => {
    stubEndpoints(false, null);

    const first = renderHook(() => useGmailStatus(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    // A staleTime like the ticket sketch's 30s would serve the cached
    // connected:false and never see the post-OAuth flip; every mount must
    // hit BOTH endpoints again (staleTime 0 + refetchOnMount 'always').
    const second = renderHook(() => useGmailStatus(), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(4); // 2 endpoints × 2 mounts
  });

  it('exports the shared query key for FE-010 consumers', () => {
    expect(GMAIL_STATUS_QUERY_KEY).toEqual(['gmail', 'status']);
  });
});

describe('startGmailConnect', () => {
  let location: ReturnType<typeof stubWindowLocation>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    location = stubWindowLocation();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
    location.restore();
  });

  it('full-page-redirects to the backend Google OAuth endpoint (re-connect = re-consent)', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');

    expect(startGmailConnect()).toBe(true);
    // There is no GET /gmail/connect on the backend — sign-in's
    // GET /auth/google already requests gmail.readonly.
    expect(location.href).toBe('https://api.example.test/auth/google');
  });

  it('navigates nowhere, logs a clear error, and returns false when VITE_API_BASE_URL is unset', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(startGmailConnect()).toBe(false);
    expect(location.href).toBe('');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('VITE_API_BASE_URL is not configured'),
    );
  });
});
