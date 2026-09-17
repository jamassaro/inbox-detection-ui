import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useChat, isLimitReachedError } from '../useChat';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';
import type { ChatAnswerWire } from '../useChat';

vi.mock('../../lib/apiClient', () => ({
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
