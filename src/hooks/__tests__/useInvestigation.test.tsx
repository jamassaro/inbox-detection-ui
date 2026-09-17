import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVESTIGATION_POLL_INTERVAL_MS,
  INVESTIGATION_TIMEOUT_MS,
  toDiscovery,
  useInvestigation,
  useInvestigationDiscoveries,
  useTriggerInvestigation,
} from '../useInvestigation';
import type { DiscoveryWire, InvestigationRecord } from '../useInvestigation';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/**
 * Builds a realistic Investigation wire row (BE-009). `status` is a free
 * String column on the backend — tests use the exact values the API emits.
 */
const wireInvestigation = (overrides: Partial<InvestigationRecord> = {}): InvestigationRecord => ({
  id: 'inv-1',
  userId: 'usr_test',
  status: 'queued',
  emailsDiscovered: 0,
  emailsProcessed: 0,
  emailsClassified: 0,
  subscriptionsFound: 0,
  offersFound: 0,
  discoveriesCreated: 0,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

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
  availableActions: ['review_subscription', 'dismiss'],
  confidence: 0.9,
  ...overrides,
});

/** Renders a hook under a fresh no-retry QueryClient (repo test convention). */
const renderInvestigationHook = (id: string | null) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useInvestigation(id), { wrapper });
};

describe('useInvestigation', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      vi.useRealTimers();
    });
  });

  it('does not poll when no investigation id is known yet', async () => {
    mockApiFetch.mockImplementation(() => new Promise<InvestigationRecord>(() => {}));
    renderInvestigationHook(null);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS * 2);
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('polls GET /investigation/:id every 3 seconds while starting', async () => {
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'queued' }));
    const { result } = renderInvestigationHook('inv-1');

    // First fetch happens on mount; the normalized status for a queued run is starting.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('starting');
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    // Poll cadence: exactly one refetch per interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('keeps polling while running and exposes live counters', async () => {
    mockApiFetch.mockResolvedValue(
      wireInvestigation({ status: 'running', emailsProcessed: 42, subscriptionsFound: 3 }),
    );
    const { result } = renderInvestigationHook('inv-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('running');
    expect(result.current.emailsReviewed).toBe(42);
    expect(result.current.categoriesSeen.subscriptions).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('stops polling at complete and records completedAt', async () => {
    const completedAt = '2026-09-17T12:00:00.000Z';
    mockApiFetch.mockResolvedValue(
      wireInvestigation({
        status: 'completed',
        emailsProcessed: 310,
        subscriptionsFound: 5,
        completedAt,
      }),
    );
    const { result } = renderInvestigationHook('inv-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('complete');
    expect(result.current.emailsReviewed).toBe(310);
    expect(result.current.completedAt).toBe(completedAt);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS * 3);
    });
    // Exactly one fetch — no refetches at the terminal state.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a backend failure as the failed state with the wire error and stops polling', async () => {
    mockApiFetch.mockResolvedValue(
      wireInvestigation({ status: 'failed', errorMessage: 'Gmail worker crashed' }),
    );
    const { result } = renderInvestigationHook('inv-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Gmail worker crashed');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS * 3);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('treats a network error as failed (recoverable via retry) and stops polling', async () => {
    mockApiFetch.mockRejectedValue(new Error('network down'));
    const { result } = renderInvestigationHook('inv-1');

    // The rejected fetch is a microtask — flush it, then read synchronously
    // (RTL waitFor hangs under vitest fake timers).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVESTIGATION_POLL_INTERVAL_MS * 3);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('maps the partial wire status to the partial state', async () => {
    mockApiFetch.mockResolvedValue(
      wireInvestigation({ status: 'partial', emailsProcessed: 90 }),
    );
    const { result } = renderInvestigationHook('inv-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('partial');
  });
});

describe('useTriggerInvestigation', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('propagates network errors to the mutation error state', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTriggerInvestigation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // Expected — the mutation surfaces it as isError.
      }
    });
    // The state transition settles a microtask after the catch — flush it.
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useInvestigationDiscoveries', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('fetches the first page of /discoveries and exposes lockedCount', async () => {
    mockApiFetch.mockResolvedValue({
      discoveries: [wireDiscovery()],
      total: 4,
      lockedCount: 3,
      pagination: { total: 4, limit: 5, offset: 0 },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useInvestigationDiscoveries(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries?limit=5');
    expect(result.current.data?.total).toBe(4);
    expect(result.current.data?.lockedCount).toBe(3);
  });
});

describe('toDiscovery (BE-028 wire → FE-011 domain)', () => {
  it('maps backend categories and derives company initials', () => {
    const domain = toDiscovery(wireDiscovery({ company: 'New York Times' }));
    expect(domain.type).toBe('subscription');
    expect(domain.companyInitials).toBe('NY');
    expect(domain.locked).toBe(false);
    expect(domain.status).toBe('new');
  });

  it('maps money → credit and change → price_change (backend semantics)', () => {
    expect(toDiscovery(wireDiscovery({ type: 'money' })).type).toBe('credit');
    expect(toDiscovery(wireDiscovery({ type: 'change' })).type).toBe('price_change');
    expect(toDiscovery(wireDiscovery({ type: 'meeting_request' })).type).toBe('meeting');
    expect(toDiscovery(wireDiscovery({ type: 'expiration' })).type).toBe('expiration');
  });

  it('falls back to the action_required catch-all and medium importance on unknown wire values', () => {
    // The backend stores type/priority as free-form strings — an unknown
    // value must never crash the card system.
    const domain = toDiscovery(
      wireDiscovery({
        type: 'something_new' as DiscoveryWire['type'],
        priority: 'critical' as DiscoveryWire['priority'],
      }),
    );
    expect(domain.type).toBe('action_required');
    expect(domain.importance).toBe('medium');
  });

  it('drops available actions the FE-011 action union does not know', () => {
    const domain = toDiscovery(
      wireDiscovery({
        availableActions: ['dismiss', 'teleport' as DiscoveryWire['availableActions'][number]],
      }),
    );
    expect(domain.availableActions).toEqual(['dismiss']);
  });

  it('maps lifecycle states, folding expired → viewed', () => {
    expect(toDiscovery(wireDiscovery({ status: 'viewed' })).status).toBe('viewed');
    expect(toDiscovery(wireDiscovery({ status: 'actioned' })).status).toBe('acted');
    expect(toDiscovery(wireDiscovery({ status: 'expired' })).status).toBe('viewed');
  });

  it('omits optional fields the wire omits instead of fabricating them', () => {
    const domain = toDiscovery(
      wireDiscovery({ amount: null, currency: null, eventDate: null, description: null }),
    );
    expect(domain.amount).toBeUndefined();
    expect(domain.currency).toBeUndefined();
    expect(domain.date).toBeUndefined();
    expect(domain.summary).toBe('');
  });
});

describe('INVESTIGATION_TIMEOUT_MS', () => {
  // The FE-009 five-minute no-infinite-spinner guarantee.
  it('is exactly 5 minutes', () => {
    expect(INVESTIGATION_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });
});
