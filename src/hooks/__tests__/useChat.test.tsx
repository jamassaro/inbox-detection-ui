import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useChat, useConversations, useLoadConversation, isLimitReachedError } from '../useChat';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ENTITLEMENTS_QUERY_KEY } from '../../contexts/entitlementContext';
import type { ChatAnswerWire, ConversationDetailWire, ConversationsListWire } from '../useChat';
import type { BillingStatusWire, Entitlements, User } from '../../types';
import { makeTestUser } from '../../test-utils';

vi.mock('../../lib/apiClient', () => ({
  // AUTH_EXPIRED_EVENT: consumed by AuthProvider, which the entitlement-decrement
  // suite below mounts alongside the real EntitlementProvider.
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireAnswer = (overrides: Partial<ChatAnswerWire> = {}): ChatAnswerWire => ({
  conversationId: 'conv-1',
  response: 'You have 3 active subscriptions.',
  sources: [{ id: 'disc-1', title: 'Netflix renews at $15.49', type: 'subscription' }],
  artifacts: [],
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

describe('useChat — conversationId threading', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('omits conversationId on the first message, then echoes back what the backend returned', async () => {
    mockApiFetch.mockResolvedValueOnce(wireAnswer({ conversationId: 'conv-abc' }));
    const { result } = renderUseChat();

    expect(result.current.conversationId).toBeUndefined();
    act(() => {
      result.current.send('What offers did I get from Everlane?');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(mockApiFetch).toHaveBeenCalledWith('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'What offers did I get from Everlane?' }),
    });
    expect(result.current.conversationId).toBe('conv-abc');

    mockApiFetch.mockResolvedValueOnce(wireAnswer({ conversationId: 'conv-abc' }));
    act(() => {
      result.current.send('Any others?');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(4));

    // Free and Pro alike — the frontend never decides whether this is honored.
    expect(mockApiFetch).toHaveBeenLastCalledWith('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Any others?', conversationId: 'conv-abc' }),
    });
  });

  it('carries artifacts through onto the rendered message', async () => {
    const artifacts: ChatAnswerWire['artifacts'] = [
      {
        type: 'offer',
        data: {
          discoveryId: 'disc-1',
          companyEntityId: 'co-1',
          company: 'Everlane',
          value: 70,
          unit: 'percent',
          expiresAt: '2026-09-23T00:00:00.000Z',
          historicalBest: true,
        },
      },
    ];
    mockApiFetch.mockResolvedValueOnce(wireAnswer({ artifacts }));
    const { result } = renderUseChat();

    act(() => {
      result.current.send('What offers did I get from Everlane?');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(result.current.messages[1]?.artifacts).toEqual(artifacts);
  });

  it('startNewConversation resets messages, conversationId, and error', async () => {
    mockApiFetch.mockResolvedValueOnce(wireAnswer({ conversationId: 'conv-abc' }));
    const { result } = renderUseChat();

    act(() => {
      result.current.send('Hello');
    });
    await waitFor(() => expect(result.current.conversationId).toBe('conv-abc'));

    act(() => {
      result.current.startNewConversation();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.error).toBeNull();

    // The reset conversationId is honored — the next send omits it again.
    mockApiFetch.mockResolvedValueOnce(wireAnswer({ conversationId: 'conv-new' }));
    act(() => {
      result.current.send('Fresh start');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(mockApiFetch).toHaveBeenLastCalledWith('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Fresh start' }),
    });
  });

  it('loadConversation hydrates the transcript from a fetched conversation', () => {
    const detail: ConversationDetailWire = {
      id: 'conv-old',
      title: 'Everlane offers',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:05:00.000Z',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'What offers did I get from Everlane?',
          sources: [],
          artifacts: [],
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'A 70% off offer, expiring soon.',
          sources: [{ id: 'disc-1', title: 'Everlane sale', type: 'money' }],
          artifacts: [],
          createdAt: '2026-09-01T10:05:00.000Z',
        },
      ],
    };
    const { result } = renderUseChat();

    act(() => {
      result.current.loadConversation(detail);
    });

    expect(result.current.conversationId).toBe('conv-old');
    expect(result.current.messages).toEqual([
      {
        id: 'm1',
        role: 'user',
        content: 'What offers did I get from Everlane?',
        sources: [],
        artifacts: [],
        timestamp: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'm2',
        role: 'detective',
        content: 'A 70% off offer, expiring soon.',
        sources: [{ id: 'disc-1', title: 'Everlane sale', type: 'money' }],
        artifacts: [],
        timestamp: '2026-09-01T10:05:00.000Z',
      },
    ]);
  });

  it('invalidates the conversations list cache after an accepted turn', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockResolvedValueOnce({
      conversations: [{ id: 'conv-abc', title: 'Old title', updatedAt: '2026-09-01T00:00:00.000Z', messageCount: 1 }],
      total: 1,
      pagination: { limit: 20, offset: 0 },
    } satisfies ConversationsListWire);

    const { result } = renderHook(
      () => ({ chat: useChat(), list: useConversations(true) }),
      { wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const callsBeforeSend = mockApiFetch.mock.calls.length;

    mockApiFetch.mockResolvedValueOnce(wireAnswer({ conversationId: 'conv-abc' }));
    mockApiFetch.mockResolvedValueOnce({
      conversations: [{ id: 'conv-abc', title: 'Updated title', updatedAt: '2026-09-24T00:00:00.000Z', messageCount: 2 }],
      total: 1,
      pagination: { limit: 20, offset: 0 },
    } satisfies ConversationsListWire);

    act(() => {
      result.current.chat.send('Hello again');
    });
    await waitFor(() => expect(result.current.chat.messages).toHaveLength(2));

    // The list refetched (invalidate), not just the POST — 2 more calls than before.
    await waitFor(() => expect(mockApiFetch.mock.calls.length).toBe(callsBeforeSend + 2));
    await waitFor(() => expect(result.current.list.data?.conversations[0]?.title).toBe('Updated title'));
  });
});

describe('useConversations', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  const renderQuery = <T,>(hook: () => T) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderHook(hook, {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
  };

  it('fetches the first page with no pagination UI (v1 scope)', async () => {
    const wire: ConversationsListWire = {
      conversations: [{ id: 'conv-1', title: 'Netflix', updatedAt: '2026-09-01T00:00:00.000Z', messageCount: 4 }],
      total: 1,
      pagination: { limit: 20, offset: 0 },
    };
    mockApiFetch.mockResolvedValue(wire);

    const { result } = renderQuery(() => useConversations(true));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/chat/conversations?limit=20&offset=0');
    expect(result.current.data).toEqual(wire);
  });

  it('never fires when disabled (Free — the endpoint would 402 anyway)', () => {
    renderQuery(() => useConversations(false));
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('surfaces the 402 pro_required error without retrying', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(402, 'pro_required', 'Pro required'));

    const { result } = renderQuery(() => useConversations(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useLoadConversation', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(cleanup);

  const renderMutation = <T,>(hook: () => T) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return renderHook(hook, {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
  };

  it('fetches one conversation by id on demand', async () => {
    const wire: ConversationDetailWire = {
      id: 'conv-1',
      title: 'Netflix',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:05:00.000Z',
      messages: [],
    };
    mockApiFetch.mockResolvedValueOnce(wire);

    const { result } = renderMutation(() => useLoadConversation());
    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/chat/conversations/conv-1');
    expect(result.current.data).toEqual(wire);
  });

  it('never fires until mutate is called', () => {
    renderMutation(() => useLoadConversation());
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('surfaces a failed load as a mutation error', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(404, 'not_found', 'not yours'));

    const { result } = renderMutation(() => useLoadConversation());
    act(() => {
      result.current.mutate('conv-not-mine');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useChat — entitlement decrement (PR #28 follow-up)', () => {
  const testUser: User = makeTestUser();;

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
