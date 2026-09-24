import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISCOVERIES_PAGE_SIZE,
  buildDiscoveriesPath,
  useDiscoveries,
  useDiscoveryFeedback,
  useDismissDiscovery,
} from '../useDiscoveries';
import { toDiscovery } from '../../lib/discoveryWire';
import type { DiscoveriesWire } from '../../lib/discoveryWire';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireRow = (overrides: Partial<DiscoveriesWire['discoveries'][number]> = {}) => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'Netflix renews at $15.49',
  description: 'Standard plan, monthly renewal.',
  company: 'Netflix',
  amount: 15.49,
  currency: 'USD',
  eventDate: '2026-10-01',
  priority: 'high',
  status: 'active',
  isLocked: false,
  availableActions: ['investigate', 'dismiss'],
  confidence: 0.9,
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

const wireResponse = (rows = [wireRow()], lockedCount = 0): DiscoveriesWire => ({
  discoveries: rows,
  total: rows.length,
  lockedCount,
  pagination: { limit: DISCOVERIES_PAGE_SIZE, offset: 0 },
});

/** Renders hooks under a fresh no-retry QueryClient (repo test convention). */
const renderQueryHook = <T,>(hook: () => T) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
};

describe('buildDiscoveriesPath', () => {
  it('always pins limit to the backend maximum and omits unset params', () => {
    expect(buildDiscoveriesPath({})).toBe(`/discoveries?limit=${DISCOVERIES_PAGE_SIZE}`);
  });

  it('passes type and status through when set', () => {
    expect(buildDiscoveriesPath({ type: 'subscription' })).toBe(
      `/discoveries?type=subscription&limit=${DISCOVERIES_PAGE_SIZE}`,
    );
    expect(buildDiscoveriesPath({ status: '' })).toBe(
      `/discoveries?status=&limit=${DISCOVERIES_PAGE_SIZE}`,
    );
  });
});

describe('toDiscovery', () => {
  it('maps wire enums to the FE-011 domain and derives company initials', () => {
    const discovery = toDiscovery(wireRow({ type: 'money', priority: 'urgent', status: 'actioned' }));
    expect(discovery.type).toBe('credit');
    expect(discovery.importance).toBe('high');
    expect(discovery.status).toBe('acted');
    expect(discovery.companyInitials).toBe('N');
    expect(discovery.createdAt).toBe('2026-09-17T11:00:00.000Z');
  });

  it('falls back to the action_required type and drops unknown wire actions', () => {
    const discovery = toDiscovery(
      wireRow({ type: 'unknown_type', availableActions: ['dismiss', 'some_future_action'] }),
    );
    expect(discovery.type).toBe('action_required');
    expect(discovery.availableActions).toEqual(['dismiss']);
  });

  it('drops amount and currency together when currency is not a formattable ISO code', () => {
    const discovery = toDiscovery(wireRow({ amount: 5, currency: 'percent' }));
    expect(discovery.amount).toBeUndefined();
    expect(discovery.currency).toBeUndefined();
  });
});

describe('useDiscoveries', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      await vi.useRealTimers();
    });
  });

  it('fetches GET /discoveries and normalizes the response', async () => {
    mockApiFetch.mockResolvedValue(wireResponse([wireRow(), wireRow({ id: 'disc-2', company: 'Spotify' })], 3));
    const { result } = renderQueryHook(() => useDiscoveries());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(`/discoveries?limit=${DISCOVERIES_PAGE_SIZE}`);
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.data?.lockedCount).toBe(3);
    expect(result.current.data?.items[0].company).toBe('Netflix');
  });
});

describe('useDismissDiscovery', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('optimistically removes the row from every cached list and PATCHes dismiss with an empty body', async () => {
    const list = wireResponse([wireRow(), wireRow({ id: 'disc-2', company: 'Spotify' })]);
    mockApiFetch.mockResolvedValue({});
    const { queryClient, result } = renderQueryHook(() => useDismissDiscovery());
    // Two cached param-variants, as the page could hold two queries at once.
    queryClient.setQueryData(['discoveries', {}], list);
    queryClient.setQueryData(['discoveries', { type: 'subscription' }], list);

    await act(async () => {
      result.current.mutate('disc-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/dismiss', { method: 'PATCH' });
    for (const key of [['discoveries', {}], ['discoveries', { type: 'subscription' }]]) {
      const cached = queryClient.getQueryData<DiscoveriesWire>(key as never);
      expect(cached?.discoveries.map((d) => d.id)).toEqual(['disc-2']);
    }
  });

  it('reverts the optimistic removal when the dismiss request fails', async () => {
    const list = wireResponse([wireRow(), wireRow({ id: 'disc-2', company: 'Spotify' })]);
    mockApiFetch.mockRejectedValue(new Error('500'));
    const { queryClient, result } = renderQueryHook(() => useDismissDiscovery());
    queryClient.setQueryData(['discoveries', {}], list);

    await act(async () => {
      result.current.mutate('disc-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<DiscoveriesWire>(['discoveries', {}]);
    expect(cached?.discoveries.map((d) => d.id)).toEqual(['disc-1', 'disc-2']);
  });
});

describe('useDiscoveryFeedback', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('PATCHes the feedback endpoint with the chosen value', async () => {
    mockApiFetch.mockResolvedValue({ success: true });
    const { result } = renderQueryHook(() => useDiscoveryFeedback());

    await act(async () => {
      result.current.mutate({ id: 'disc-1', feedback: 'not_useful' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/feedback', {
      method: 'PATCH',
      body: JSON.stringify({ feedback: 'not_useful' }),
    });
  });
});
