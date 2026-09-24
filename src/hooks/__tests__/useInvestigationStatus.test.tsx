import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVESTIGATION_LOOKBACK_DAYS,
  INVESTIGATION_STATUS_PATH,
  scanLookbackRange,
  useInvestigationStatus,
  useRefreshInvestigationStatus,
} from '../useInvestigationStatus';
import type { InvestigationStatusWire } from '../useInvestigationStatus';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireStatus = (overrides: Partial<InvestigationStatusWire> = {}): InvestigationStatusWire => ({
  latestScan: {
    id: 'inv-1',
    status: 'completed',
    startedAt: '2026-09-23T11:00:00.000Z',
    completedAt: '2026-09-23T11:05:00.000Z',
    emailsProcessed: 120,
    emailsDiscovered: 120,
    discoveriesCreated: 3,
  },
  monitoring: { enabled: true, intervalMinutes: 60, nextScanAt: '2026-09-23T12:05:00.000Z' },
  ...overrides,
});

const renderStatusHook = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useInvestigationStatus(), { wrapper }) };
};

describe('useInvestigationStatus', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('fetches GET /investigation/status and exposes the wire body', async () => {
    mockApiFetch.mockResolvedValue(wireStatus());
    const { result } = renderStatusHook();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(INVESTIGATION_STATUS_PATH);
    expect(result.current.data?.latestScan?.discoveriesCreated).toBe(3);
    expect(result.current.data?.monitoring.nextScanAt).toBe('2026-09-23T12:05:00.000Z');
  });

  it('reports latestScan: null for a user who has never scanned', async () => {
    mockApiFetch.mockResolvedValue(
      wireStatus({ latestScan: null, monitoring: { enabled: false, intervalMinutes: 60, nextScanAt: null } }),
    );
    const { result } = renderStatusHook();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.latestScan).toBeNull();
    expect(result.current.data?.monitoring.enabled).toBe(false);
  });

  it('surfaces a failed read immediately, with no retry', async () => {
    mockApiFetch.mockRejectedValue(new Error('500'));
    const { result } = renderStatusHook();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useRefreshInvestigationStatus', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('invalidates the cached status query', async () => {
    mockApiFetch.mockResolvedValue(wireStatus());
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({ status: useInvestigationStatus(), refresh: useRefreshInvestigationStatus() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
  });
});

describe('scanLookbackRange', () => {
  it('anchors the window at startedAt, spanning the fixed lookback', () => {
    const { start, end } = scanLookbackRange('2026-09-23T11:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-23T11:00:00.000Z');
    const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INVESTIGATION_LOOKBACK_DAYS);
  });

  it('falls back to the current time when the run has not started yet', () => {
    const before = Date.now();
    const { end } = scanLookbackRange(null);
    expect(end.getTime()).toBeGreaterThanOrEqual(before);
  });
});
