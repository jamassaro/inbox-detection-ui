import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../AuthProvider';
import { EntitlementProvider } from '../EntitlementProvider';
import { ENTITLEMENTS_QUERY_KEY } from '../entitlementContext';
import { useAuth } from '../../hooks/useAuth';
import { useEntitlements } from '../../hooks/useEntitlements';
import { apiFetch } from '../../lib/apiClient';
import { ApiError } from '../../lib/apiError';
import type { BillingStatusWire, Entitlements, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

/** Wire body of GET /billing/status (BE-030) — verified against Inbox-api src. */
const FREE_STATUS: BillingStatusWire = {
  plan: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 500,
    visibleDiscoveryLimit: 5,
    continuousMonitoring: false,
    reminders: false,
    calendarActions: false,
    emailActions: false,
    detectiveChatLimit: 3,
    historicalComparison: false,
    dailyBriefing: false,
    fullDiscoveryHistory: false,
  },
};

const PRO_STATUS: BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 2000,
    visibleDiscoveryLimit: null, // Infinity serializes to null over JSON
    continuousMonitoring: true,
    reminders: true,
    calendarActions: true,
    emailActions: true,
    detectiveChatLimit: null,
    historicalComparison: true,
    dailyBriefing: true,
    fullDiscoveryHistory: true,
  },
};

/** What mapBillingStatusToEntitlements yields for the wire fixtures above. */
const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  visibleDiscoveries: 5,
  continuousMonitoring: false,
  reminders: false,
  calendarActions: false,
  emailActions: false,
  dailyBriefing: false,
  chatQuestionsRemaining: 3,
};

const PRO_ENTITLEMENTS: Entitlements = {
  plan: 'pro',
  visibleDiscoveries: null,
  continuousMonitoring: true,
  reminders: true,
  calendarActions: true,
  emailActions: true,
  dailyBriefing: true,
  chatQuestionsRemaining: null,
};

describe('EntitlementContext', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <EntitlementProvider>{children}</EntitlementProvider>
      </QueryClientProvider>
    </AuthProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('fetches /billing/status (never /user/entitlements) and exposes the Free plan', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.entitlements).toEqual(FREE_ENTITLEMENTS));

    expect(mockApiFetch).toHaveBeenCalledWith('/billing/status');
    expect(mockApiFetch).not.toHaveBeenCalledWith('/user/entitlements');
    expect(result.current.plan).toBe('free');
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes the Pro plan when the backend returns Pro entitlements', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(PRO_STATUS); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.entitlements).toEqual(PRO_ENTITLEMENTS));

    expect(result.current.plan).toBe('pro');
    expect(result.current.isPro).toBe(true);
  });

  it('isLoading until the fetch resolves, entitlements null meanwhile', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    let resolveStatus: (s: BillingStatusWire) => void = () => {};
    mockApiFetch.mockImplementationOnce(
      () => new Promise<BillingStatusWire>((res) => { resolveStatus = res; }),
    );

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.entitlements).toBeNull();

    await act(async () => { resolveStatus(FREE_STATUS); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entitlements).toEqual(FREE_ENTITLEMENTS);
  });

  it('backend error leaves entitlements null without throwing', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockRejectedValueOnce(new Error('500')); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entitlements).toBeNull();
  });

  it('unauthenticated session: entitlements null and no entitlement fetch fires', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'no session')); // /auth/me: definitive logged-out answer

    const { result } = renderHook(
      () => ({ auth: useAuth(), entitlements: useEntitlements() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(result.current.entitlements.entitlements).toBeNull();
    expect(result.current.entitlements.isLoading).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalledWith('/billing/status');
    expect(mockApiFetch).not.toHaveBeenCalledWith('/user/entitlements');
  });

  it('refresh() re-fetches and updates the TanStack Query cache', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // initial fetch
    mockApiFetch.mockResolvedValueOnce(PRO_STATUS); // refresh fetch

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.entitlements?.plan).toBe('free'));

    await act(async () => { await result.current.refresh(); });

    await waitFor(() => expect(result.current.entitlements).toEqual(PRO_ENTITLEMENTS));
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
    expect(queryClient.getQueryData(ENTITLEMENTS_QUERY_KEY)).toEqual(PRO_ENTITLEMENTS);
  });

  it('refresh() does not fetch while unauthenticated', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'no session')); // /auth/me: definitive logged-out answer

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.refresh(); });

    expect(mockApiFetch).toHaveBeenCalledTimes(1); // only /auth/me
  });

  describe('decrementChatQuestions (PR #28 follow-up — client-side chat counter)', () => {
    it('decrements the cached counter and clamps at 0', async () => {
      mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
      mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // /billing/status

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.entitlements).toEqual(FREE_ENTITLEMENTS));

      // One accepted turn each; waitFor re-reads the hook after the cache
      // update re-renders the provider (concurrent scheduling in React 19).
      act(() => { result.current.decrementChatQuestions(); });
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(2));

      act(() => { result.current.decrementChatQuestions(); });
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(1));

      act(() => { result.current.decrementChatQuestions(); });
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(0));

      // A fourth accepted turn must not go negative.
      act(() => { result.current.decrementChatQuestions(); });
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(0));
      expect(queryClient.getQueryData(ENTITLEMENTS_QUERY_KEY)).toEqual({
        ...FREE_ENTITLEMENTS,
        chatQuestionsRemaining: 0,
      });
    });

    it('leaves the Pro (null) counter untouched', async () => {
      mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
      mockApiFetch.mockResolvedValueOnce(PRO_STATUS); // /billing/status

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.entitlements).toEqual(PRO_ENTITLEMENTS));

      act(() => { result.current.decrementChatQuestions(); });

      expect(result.current.chatQuestionsRemaining).toBeNull();
      expect(queryClient.getQueryData(ENTITLEMENTS_QUERY_KEY)).toEqual(PRO_ENTITLEMENTS);
    });

    it('refresh() re-seeds the counter from the daily allowance after decrements', async () => {
      mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
      mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // initial fetch
      mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // refresh fetch

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.entitlements).toEqual(FREE_ENTITLEMENTS));

      act(() => { result.current.decrementChatQuestions(); });
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(2));

      await act(async () => { await result.current.refresh(); });

      // The decrement is a display estimate, not persistence: the refetched
      // /billing/status re-seeds the allowance (detectiveChatLimit: 3).
      await waitFor(() => expect(result.current.chatQuestionsRemaining).toBe(3));
    });

    it('is a no-op on an empty cache (unauthenticated) without throwing', async () => {
      mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'no session')); // /auth/me: definitive logged-out answer

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(() => act(() => { result.current.decrementChatQuestions(); })).not.toThrow();
      expect(queryClient.getQueryData(ENTITLEMENTS_QUERY_KEY)).toBeUndefined();
    });
  });
});
