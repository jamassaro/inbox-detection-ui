import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { GMAIL_STATUS_QUERY_KEY, startGmailConnect, useGmailStatus } from '../useGmailStatus';
import type { GmailStatus } from '../useGmailStatus';
import { apiFetch } from '../../lib/apiClient';
import { stubWindowLocation } from '../../test-utils';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const gmailStatus = (overrides: Partial<GmailStatus> = {}): GmailStatus => ({
  connected: false,
  email: null,
  lastSync: null,
  ...overrides,
});

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

  it('fetches GET /gmail/status and exposes the connected payload', async () => {
    const status = gmailStatus({
      connected: true,
      email: 'ada@example.com',
      lastSync: '2026-09-17T10:00:00Z',
    });
    mockApiFetch.mockResolvedValueOnce(status);

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(status));
    expect(result.current.data?.connected).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/gmail/status');
  });

  it('exposes the disconnected payload', async () => {
    mockApiFetch.mockResolvedValueOnce(gmailStatus());

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(gmailStatus()));
    expect(result.current.data?.connected).toBe(false);
    expect(result.current.data?.email).toBeNull();
  });

  it('stays in the loading state while the status request never settles', async () => {
    mockApiFetch.mockImplementation(() => new Promise<GmailStatus>(() => {}));

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces a failed status check as an error instead of silently retrying', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));

    const { result } = renderHook(() => useGmailStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: false — one failed fetch, immediately visible to the caller.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('re-checks status on every mount — no cross-mount caching during onboarding', async () => {
    mockApiFetch.mockResolvedValue(gmailStatus());

    const first = renderHook(() => useGmailStatus(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    // A staleTime like the ticket sketch's 30s would serve the cached
    // connected:false and never see the post-OAuth flip; every mount must
    // hit the endpoint (staleTime 0 + refetchOnMount 'always').
    const second = renderHook(() => useGmailStatus(), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
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

  it('full-page-redirects to the backend Gmail connect endpoint', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');

    expect(startGmailConnect()).toBe(true);
    expect(location.href).toBe('https://api.example.test/gmail/connect');
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
