import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DASHBOARD_WINDOW_LIMIT,
  deriveDashboardStats,
  isHighPriority,
  selectPriorityDiscoveries,
  useDashboard,
} from '../useDashboard';
import type { DiscoveriesWire, DiscoveryWire } from '../useInvestigation';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Builds a realistic BE-028 wire row for GET /discoveries. */
const wireDiscovery = (overrides: Partial<DiscoveryWire> = {}): DiscoveryWire => ({
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
  ...overrides,
});

const wireResponse = (
  discoveries: DiscoveryWire[],
  overrides: Partial<DiscoveriesWire> = {},
): DiscoveriesWire => ({
  discoveries,
  total: discoveries.length,
  lockedCount: 0,
  pagination: { limit: DASHBOARD_WINDOW_LIMIT, offset: 0 },
  ...overrides,
});

/** Renders the hook under a fresh no-retry QueryClient (repo test convention). */
const renderDashboardHook = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDashboard(), { wrapper });
};

describe('isHighPriority', () => {
  it('treats the two backend high-urgency priorities as needing attention', () => {
    expect(isHighPriority(wireDiscovery({ priority: 'urgent' }))).toBe(true);
    expect(isHighPriority(wireDiscovery({ priority: 'high' }))).toBe(true);
    expect(isHighPriority(wireDiscovery({ priority: 'medium' }))).toBe(false);
    expect(isHighPriority(wireDiscovery({ priority: 'low' }))).toBe(false);
  });
});

describe('deriveDashboardStats', () => {
  it('sums money per currency, counts subscriptions, and counts high-priority rows', () => {
    const stats = deriveDashboardStats([
      wireDiscovery({ type: 'subscription', priority: 'urgent', amount: 15.49 }),
      wireDiscovery({ id: 'd2', type: 'subscription', priority: 'medium', amount: 9.99 }),
      wireDiscovery({ id: 'd3', type: 'change', priority: 'high', amount: 4.5 }),
      wireDiscovery({ id: 'd4', type: 'money', priority: 'low', amount: 100 }),
      wireDiscovery({ id: 'd5', type: 'expiration', priority: 'medium', amount: null }),
      wireDiscovery({ id: 'd6', type: 'expiration', priority: 'low', amount: 20, currency: 'EUR' }),
    ]);

    expect(stats.moneyFound).toEqual([
      { currency: 'EUR', amount: 20 },
      { currency: 'USD', amount: 129.98 },
    ]);
    expect(stats.subscriptionCount).toBe(2);
    expect(stats.needsAttentionCount).toBe(2); // urgent + high
  });

  it('excludes rows with a non-monetary currency from moneyFound', () => {
    const stats = deriveDashboardStats([
      wireDiscovery({ id: 'd1', type: 'change', priority: 'medium', amount: 5, currency: 'percent' }),
      wireDiscovery({ id: 'd2', type: 'money', priority: 'low', amount: 100, currency: 'USD' }),
    ]);

    expect(stats.moneyFound).toEqual([{ currency: 'USD', amount: 100 }]);
  });

  it('derives all-zero stats from an empty window', () => {
    expect(deriveDashboardStats([])).toEqual({
      moneyFound: [],
      subscriptionCount: 0,
      needsAttentionCount: 0,
    });
  });
});

describe('selectPriorityDiscoveries', () => {
  it('filters locked rows, orders urgent-first, caps at five, and keeps backend recency on ties', () => {
    const window = [
      wireDiscovery({ id: 'low-1', priority: 'low' }),
      wireDiscovery({ id: 'urgent-1', priority: 'urgent', type: 'expiration' }),
      wireDiscovery({ id: 'locked-high', priority: 'high', isLocked: true }),
      wireDiscovery({ id: 'high-1', priority: 'high' }),
      wireDiscovery({ id: 'high-2', priority: 'high' }),
      wireDiscovery({ id: 'high-3', priority: 'high' }),
      wireDiscovery({ id: 'medium-1', priority: 'medium' }),
    ];

    const selected = selectPriorityDiscoveries(window);

    expect(selected.map((d) => d.id)).toEqual([
      'urgent-1',
      'high-1',
      'high-2',
      'high-3',
      'medium-1',
    ]);
    expect(selected.every((d) => !d.locked)).toBe(true);
  });

  it('maps rows through toDiscovery so the cards get FE-011 domain objects', () => {
    const selected = selectPriorityDiscoveries([wireDiscovery({ priority: 'urgent' })]);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.importance).toBe('high'); // urgent folds into high importance
    expect(selected[0]?.companyInitials).toBe('N');
    expect(selected[0]?.availableActions).toEqual(['investigate', 'dismiss']);
  });
});

describe('useDashboard', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('fetches the active window with limit=100 and derives the page data', async () => {
    mockApiFetch.mockResolvedValue(
      wireResponse([
        wireDiscovery(),
        wireDiscovery({
          id: 'd2',
          type: 'change',
          priority: 'medium',
          amount: 10.99,
          company: 'Spotify',
          title: 'Spotify went up',
        }),
      ]),
    );
    const { result } = renderDashboardHook();

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/discoveries?status=active&limit=${DASHBOARD_WINDOW_LIMIT}`,
    );
    expect(result.current.data?.stats.subscriptionCount).toBe(1);
    expect(result.current.data?.stats.needsAttentionCount).toBe(1);
    expect(result.current.data?.stats.moneyFound).toEqual([{ currency: 'USD', amount: 26.48 }]);
    expect(result.current.data?.priorityDiscoveries[0]?.id).toBe('disc-1');
    expect(result.current.data?.isEmpty).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('flags the empty state when the active window is empty', async () => {
    mockApiFetch.mockResolvedValue(wireResponse([]));
    const { result } = renderDashboardHook();

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isEmpty).toBe(true);
    expect(result.current.data?.priorityDiscoveries).toEqual([]);
  });

  it('surfaces a failed window load as the error state for the retry CTA', async () => {
    mockApiFetch.mockRejectedValue(new Error('discoveries unavailable'));
    const { result } = renderDashboardHook();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('dismisses optimistically and rolls the row back when the PATCH fails', async () => {
    let rejectDismiss: (error: Error) => void = () => {};
    mockApiFetch.mockImplementation((path: string) => {
      if (path.includes('/dismiss')) {
        return new Promise<DiscoveryWire>((_resolve, reject) => {
          rejectDismiss = reject;
        });
      }
      return Promise.resolve(
        wireResponse([wireDiscovery(), wireDiscovery({ id: 'd2', title: 'Spotify went up' })]),
      );
    });

    const { result } = renderDashboardHook();
    await waitFor(() => expect(result.current.data?.priorityDiscoveries).toHaveLength(2));

    act(() => {
      result.current.dismiss.mutate('disc-1');
    });

    // Optimistic: the row leaves the window before the PATCH settles.
    await waitFor(() => expect(result.current.data?.priorityDiscoveries).toHaveLength(1));
    expect(result.current.data?.priorityDiscoveries[0]?.id).toBe('d2');

    await act(async () => {
      rejectDismiss(new Error('dismiss failed'));
    });

    // Rollback restores the row (invalidation refetches the same window).
    await waitFor(() => expect(result.current.data?.priorityDiscoveries).toHaveLength(2));
    expect(result.current.isError).toBe(false);
  });

  it('keeps the row removed when the dismiss PATCH succeeds', async () => {
    const rows = [wireDiscovery(), wireDiscovery({ id: 'd2', title: 'Spotify went up' })];
    // A real dismissal is reflected in the next GET /discoveries response.
    const dismissedIds = new Set<string>();
    mockApiFetch.mockImplementation((path: string) => {
      if (path.includes('/dismiss')) {
        dismissedIds.add(path.split('/')[2] ?? '');
        return Promise.resolve({ ...wireDiscovery(), status: 'dismissed' });
      }
      return Promise.resolve(wireResponse(rows.filter((d) => !dismissedIds.has(d.id))));
    });

    const { result } = renderDashboardHook();
    await waitFor(() => expect(result.current.data?.priorityDiscoveries).toHaveLength(2));

    await act(async () => {
      result.current.dismiss.mutate('disc-1');
    });

    await waitFor(() => expect(result.current.data?.priorityDiscoveries).toHaveLength(1));
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/dismiss', { method: 'PATCH' });
  });
});
