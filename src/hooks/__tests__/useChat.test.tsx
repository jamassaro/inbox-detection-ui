import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useChat, isLimitReachedError } from '../useChat';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ENTITLEMENTS_QUERY_KEY } from '../../contexts/entitlementContext';
import type { ChatAnswerWire } from '../useChat';
import type { BillingStatusWire, Entitlements, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  // AUTH_EXPIRED_EVENT: consumed by AuthProvider, which the entitlement-decrement
  // suite below mounts alongside the real EntitlementProvider.
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireAnswer = (overrides: Partial<ChatAnswerWire> = {}): ChatAnswerWire => ({
  response: 'You have 3 active subscriptions.',
  sources: [{ id: 'disc-1', title: 'Netflix renews at $15.49', type: 'subscription' }],
  ...overrides,
});

const renderUseChat = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderHook(() => useChat(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
};

describe('isLimitReachedError', () => {
  it('detects the backend 402 pro_required response', () => {
    expect(isLimitReachedError(new ApiError(402, 'UNKNOWN_ERROR', 'limit reached'))).toBe(true);
  });

  it('is false for other statuses and non-ApiError values', () => {
    expect(isLimitReachedError(new ApiError(502, 'chat_unavailable', 'down'))).toBe(false);
    expect(isLimitReachedError(new Error('boom'))).toBe(false);
    expect(isLimitReachedError(null)).toBe(false);
  });
});

describe('useChat', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('posts the question to POST /chat and appends the detective answer with sources', async () => {
    mockApiFetch.mockResolvedValueOnce(wireAnswer());
    const { result } = renderUseChat();

    act(() => {
      result.current.send('  Which subscriptions am I paying for?  ');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/chat', {
      method: 'POST',
      // Trimmed before the wire — the backend zod schema is trim().min(1).
      body: JSON.stringify({ message: 'Which subscriptions am I paying for?' }),
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    const [user, detective] = result.current.messages;
    expect(user.role).toBe('user');
    expect(user.content).toBe('Which subscriptions am I paying for?');
    expect(detective.role).toBe('detective');
    // AI content is rendered as-is — the hook must not transform it.
    expect(detective.content).toBe('You have 3 active subscriptions.');
    expect(detective.sources).toEqual([
      { id: 'disc-1', title: 'Netflix renews at $15.49', type: 'subscription' },
    ]);
  });

  it('appends the user message optimistically before the response arrives', async () => {
    // Never-settling request — the optimistic turn must be visible on its own
    // (a deferred resolution would add extra act cycles without proving more).
    mockApiFetch.mockImplementation(() => new Promise<ChatAnswerWire>(() => {}));
    const { result } = renderUseChat();

    act(() => {
      result.current.send('Any credits expiring?');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe('user');
    expect(result.current.messages[0]?.content).toBe('Any credits expiring?');

    // Cleanup for the next test's mockReset.
    mockApiFetch.mockReset();
  });

  it('rolls the optimistic message back and exposes the error when the request fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(502, 'chat_unavailable', 'LLM synthesis failed'));
    const { result } = renderUseChat();

    act(() => {
      result.current.send('How much am I spending?');
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error?.status).toBe(502);
    expect(result.current.error?.code).toBe('chat_unavailable');
    expect(result.current.isLoading).toBe(false);
  });

  it('clears a previous error and keeps older turns after a successful retry', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'UNKNOWN_ERROR', 'failed'));
    const { result } = renderUseChat();

    act(() => {
      result.current.send('How much am I spending?');
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    mockApiFetch.mockResolvedValueOnce(wireAnswer({ response: 'About $64.' }));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    // The rolled-back turn is restored once, not duplicated.
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.content).toBe('How much am I spending?');
    expect(result.current.messages[1]?.content).toBe('About $64.');
  });

  it('ignores empty and whitespace-only messages', () => {
    const { result } = renderUseChat();

    act(() => {
      result.current.send('   ');
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});

describe('useChat — entitlement decrement (PR #28 follow-up)', () => {
  const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

  /** Wire body of GET /billing/status (BE-030) for the given plan. */
  const billingStatus = (plan: 'free' | 'pro'): BillingStatusWire => ({
    plan,
    subscriptionStatus: plan === 'pro' ? 'active' : null,
    currentPeriodEnd: plan === 'pro' ? '2026-10-17T00:00:00.000Z' : null,
    cancelAtPeriodEnd: false,
    entitlements: {
      investigationEmailLimit: plan === 'pro' ? 2000 : 500,
      visibleDiscoveryLimit: plan === 'pro' ? null : 5,
      continuousMonitoring: plan === 'pro',
      reminders: plan === 'pro',
      calendarActions: plan === 'pro',
      emailActions: plan === 'pro',
      detectiveChatLimit: plan === 'pro' ? null : 3,
      historicalComparison: plan === 'pro',
      dailyBriefing: plan === 'pro',
      fullDiscoveryHistory: plan === 'pro',
    },
  });

  const remainingInCache = (queryClient: QueryClient): number | null | undefined =>
    queryClient.getQueryData<Entitlements>(ENTITLEMENTS_QUERY_KEY)?.chatQuestionsRemaining;

  /** Real EntitlementProvider + auth session — the wiring useChat decrements through. */
  const renderUseChatWithEntitlements = (status: BillingStatusWire) => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(status); // /billing/status
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const utils = renderHook(() => useChat(), {
      wrapper: ({ children }) => (
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <EntitlementProvider>{children}</EntitlementProvider>
          </QueryClientProvider>
        </AuthProvider>
      ),
    });
    return { ...utils, queryClient };
  };

  afterEach(() => {
    cleanup();
  });

  it('decrements the shared entitlements cache after a successful send', async () => {
    const { result, queryClient } = renderUseChatWithEntitlements(billingStatus('free'));
    await waitFor(() => expect(remainingInCache(queryClient)).toBe(3));

    mockApiFetch.mockResolvedValueOnce(wireAnswer()); // POST /chat
    act(() => {
      result.current.send('Which subscriptions am I paying for?');
    });
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(remainingInCache(queryClient)).toBe(2);
  });

  it('clamps the counter at 0 across repeated sends', async () => {
    const freeStatus = billingStatus('free');
    const oneQuestion: BillingStatusWire = {
      ...freeStatus,
      entitlements: { ...freeStatus.entitlements, detectiveChatLimit: 1 },
    };
    const { result, queryClient } = renderUseChatWithEntitlements(oneQuestion);
    await waitFor(() => expect(remainingInCache(queryClient)).toBe(1));

    for (let turn = 0; turn < 2; turn += 1) {
      mockApiFetch.mockResolvedValueOnce(wireAnswer()); // POST /chat
      act(() => {
        result.current.send(`Question ${turn}`);
      });
      await waitFor(() => {
        expect(result.current.messages).toHaveLength((turn + 1) * 2);
      });
    }

    // Two accepted turns against an allowance of 1 — clamped, never negative.
    expect(remainingInCache(queryClient)).toBe(0);
  });

  it('leaves a null counter untouched for Pro (unlimited) users', async () => {
    const { result, queryClient } = renderUseChatWithEntitlements(billingStatus('pro'));
    await waitFor(() => expect(remainingInCache(queryClient)).toBeNull());

    mockApiFetch.mockResolvedValueOnce(wireAnswer()); // POST /chat
    act(() => {
      result.current.send('Unlimited question');
    });
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(remainingInCache(queryClient)).toBeNull();
  });

  it('does not decrement on a failed request (402 keeps the count)', async () => {
    const { result, queryClient } = renderUseChatWithEntitlements(billingStatus('free'));
    await waitFor(() => expect(remainingInCache(queryClient)).toBe(3));

    mockApiFetch.mockRejectedValueOnce(new ApiError(402, 'pro_required', 'limit reached'));
    act(() => {
      result.current.send('One more question?');
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    // Only accepted turns consume a question — the optimistic turn rolled back.
    expect(remainingInCache(queryClient)).toBe(3);
    expect(result.current.messages).toHaveLength(0);
  });
});
