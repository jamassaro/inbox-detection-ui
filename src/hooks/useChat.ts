import { useContext, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/apiError';
import { EntitlementContext } from '../contexts/entitlementContext';

/**
 * Detective Chat hook (FE-022, V2 conversation history/artifacts hand-off
 * 2026-09-24).
 *
 * Wire contract — verified against Inbox-api BE-037 (src/api/routes/chat.routes.ts,
 * mounted at `app.use('/chat', …)` in src/api/server.ts):
 *
 * - `POST /chat` body `{ message, conversationId? }` → 200 `{ conversationId,
 *   response, sources, artifacts }`. `conversationId` is Pro-only in effect —
 *   Free always gets one back, but the backend silently ignores it and
 *   starts fresh every time. The frontend never branches on plan for this:
 *   it always echoes back whatever `conversationId` it was last given: the
 *   backend's own behavior is what makes Free stateless, not a client check.
 * - `sources` rows are `{ id, title, type }` and always reference Discoveries
 *   (top 3 active discoveries used as grounding context). `id` is a real
 *   discoveryId — linkable to `/app/discoveries/:id`.
 * - `artifacts` are 0-2 structured cards built from real account data, never
 *   invented by the model — see `ChatArtifact` below.
 * - `GET /chat/conversations?limit&offset` and `GET /chat/conversations/:id`
 *   are Pro-only (402 `{ error: 'pro_required', upgradeContext:
 *   'conversationHistory' }` for Free) — see `useConversations`/
 *   `useConversation`.
 * - Free plan daily limit → 402 `{ error: 'pro_required' }` (BE-012). LLM
 *   synthesis failure → 502 `{ error: 'chat_unavailable' }`.
 *
 * Entitlement display: the wire carries no server-decremented remaining
 * count, so each accepted turn consumes one question from the shared
 * entitlements cache (decrementChatQuestions) — a display estimate that
 * clamps at 0 and re-seeds from the daily allowance on the next
 * /billing/status fetch. The 402 pro_required error stays the enforcement
 * source of truth.
 *
 * The backend generates `response` in the user's locale (User.locale row) and
 * it is rendered as-is — never translated or transformed in the frontend.
 */

/** Backend path of the chat endpoint (BE-037). */
export const CHAT_PATH = '/chat';

/** A grounded reference cited by the Detective — always a Discovery (BE-037). */
export interface ChatSource {
  id: string;
  title: string;
  /** Backend Discovery type (money|subscription|expiration|meeting_request|change). */
  type: string;
}

/**
 * Structured, deterministic data attached to an assistant reply — always
 * built from real account data, never authored by the model. `unit` on
 * offer-shaped artifacts is not always a currency: it can be "percent",
 * "points", or a real ISO code — never assume USD.
 */
export type ChatArtifact =
  | {
      type: 'company';
      data: {
        companyEntityId: string;
        name: string;
        offerCount: number;
        /** Omitted (never guessed) when no USD-valued offer exists for this company. */
        bestOffer?: { value: number; unit: 'USD' };
        lastSeenAt: string;
      };
    }
  | {
      type: 'offer';
      data: {
        discoveryId: string;
        companyEntityId: string;
        company: string;
        value: number;
        unit: string;
        /** Omitted (never guessed) when the offer has no expiration. */
        expiresAt?: string;
        historicalBest: boolean;
      };
    }
  | {
      type: 'offer_history';
      data: {
        companyEntityId: string;
        company: string;
        /** Oldest first. */
        offers: { discoveryId: string; date: string; value: number; unit: string; best?: true }[];
      };
    };

/** Wire body of `POST /chat` (BE-037). */
export interface ChatAnswerWire {
  conversationId: string;
  response: string;
  sources: ChatSource[];
  artifacts: ChatArtifact[];
}

/** One chat turn as rendered by ChatPage. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'detective';
  /** AI-generated for the detective role — rendered as-is, never through t(). */
  content: string;
  sources?: ChatSource[];
  artifacts?: ChatArtifact[];
  timestamp: string;
}

/** One row of `GET /chat/conversations` — no message content, just enough to list. */
export interface ConversationSummaryWire {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

/** Wire body of `GET /chat/conversations`. */
export interface ConversationsListWire {
  conversations: ConversationSummaryWire[];
  total: number;
  pagination: { limit: number; offset: number };
}

/** One stored turn as returned by `GET /chat/conversations/:id` (both roles carry the same shape on the wire). */
export interface ConversationMessageWire {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  artifacts: ChatArtifact[];
  createdAt: string;
}

/** Wire body of `GET /chat/conversations/:id`. */
export interface ConversationDetailWire {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessageWire[];
}

/** True when the backend rejected the question with the Free-plan limit error (402). */
export function isLimitReachedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402;
}

let idCounter = 0;
const nextMessageId = (): string => `msg-${Date.now().toString(36)}-${(idCounter += 1)}`;

export interface UseChatResult {
  messages: ChatMessage[];
  /**
   * The active conversation, once the first reply has arrived (Pro: the
   * backend keeps stitching turns onto it; Free: real but inert — the
   * backend always starts fresh regardless of what's echoed back). Also
   * set by `loadConversation`. `undefined` before any turn completes.
   */
  conversationId: string | undefined;
  /** Appends the user turn optimistically, then POSTs it. Empty/whitespace is ignored. */
  send: (content: string) => void;
  /** Re-sends the most recent message (used by the inline ErrorState retry). */
  retry: () => void;
  /** Resets to a fresh, empty conversation — a local reset, never a backend call. */
  startNewConversation: () => void;
  /** Replaces the transcript with a previously-fetched conversation (GET /chat/conversations/:id). */
  loadConversation: (detail: ConversationDetailWire) => void;
  /** True while `POST /chat` is in flight. */
  isLoading: boolean;
  error: ApiError | null;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const lastSentRef = useRef<string | null>(null);
  // Null-safe by design: outside an EntitlementProvider (isolated hook use,
  // tests) there is no shared counter and the hook still works.
  const entitlements = useContext(EntitlementContext);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      // conversationId is always echoed back, Free and Pro alike — the
      // backend, not a plan check here, decides whether it's honored.
      const wire = await apiFetch<ChatAnswerWire>(CHAT_PATH, {
        method: 'POST',
        body: JSON.stringify({ message: content, conversationId }),
      });
      const message: ChatMessage = {
        id: nextMessageId(),
        role: 'detective',
        content: wire.response,
        sources: wire.sources,
        artifacts: wire.artifacts,
        timestamp: new Date().toISOString(),
      };
      return { message, conversationId: wire.conversationId };
    },
  });

  const send = (raw: string) => {
    const content = raw.trim();
    if (content === '' || mutation.isPending) return;
    lastSentRef.current = content;
    const userMessage: ChatMessage = {
      id: nextMessageId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    // Optimistic append — the user's turn shows immediately.
    setMessages((prev) => [...prev, userMessage]);
    mutation.mutate(content, {
      onSuccess: ({ message, conversationId: newConversationId }) => {
        setError(null);
        setConversationId(newConversationId);
        setMessages((prev) => [...prev, message]);
        // One accepted turn = one question consumed from the shared cache
        // (display estimate; the 402 pro_required error enforces the real
        // limit). Failed turns never decrement — only successful POSTs do.
        entitlements?.decrementChatQuestions();
        // Keep the History column's titles/counts/order fresh while a
        // conversation is actively being chatted in — cheap no-op for Free
        // (nothing subscribes to this key there, since the column never
        // fetches it) and harmless if it's a brand-new conversation not yet
        // in the cached list.
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      },
      onError: (mutationError) => {
        // Roll the optimistic turn back: the transcript may only contain
        // turns the server actually accepted (same trust rule as the
        // dashboard dismissal rollback). The error + retry path restores it.
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        setError(
          mutationError instanceof ApiError
            ? mutationError
            : new ApiError(0, 'NETWORK_ERROR', 'Chat request failed'),
        );
      },
    });
  };

  const retry = () => {
    if (lastSentRef.current !== null) send(lastSentRef.current);
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    lastSentRef.current = null;
  };

  const loadConversation = (detail: ConversationDetailWire) => {
    setMessages(
      detail.messages.map((m) => ({
        id: m.id,
        role: m.role === 'assistant' ? 'detective' : 'user',
        content: m.content,
        sources: m.sources,
        artifacts: m.artifacts,
        timestamp: m.createdAt,
      })),
    );
    setConversationId(detail.id);
    setError(null);
    lastSentRef.current = null;
  };

  return {
    messages,
    conversationId,
    send,
    retry,
    startNewConversation,
    loadConversation,
    isLoading: mutation.isPending,
    error,
  };
}

/** Cache key prefix for the conversation list — useChat invalidates this after every accepted turn, so titles/counts/order never go stale while the History column is open. */
const CONVERSATIONS_QUERY_KEY = ['chat', 'conversations'] as const;

/** V1 scope: first page only — see the module docs' "no pagination" note. */
const CONVERSATIONS_LIST_PATH = '/chat/conversations?limit=20&offset=0';

/**
 * The signed-in Pro user's past conversations, newest first (backend order).
 * Free always 402s this — `enabled` should be gated on `useEntitlements().isPro`
 * by the caller so a guaranteed-failing request is never fired.
 */
export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: () => apiFetch<ConversationsListWire>(CONVERSATIONS_LIST_PATH),
    enabled,
    retry: false,
  });
}

/**
 * Fetches one past conversation on demand (e.g. clicking a history row) —
 * a `useMutation`, not `useQuery`: this is a one-off imperative fetch
 * triggered by a user action with an onSuccess/onError the caller reacts
 * to (load it into the transcript, or show an error), not a reactively-
 * rendered subscription — the same shape as every other one-off action in
 * this codebase (e.g. useDeleteReminder).
 */
export function useLoadConversation() {
  return useMutation({
    mutationFn: (id: string) => apiFetch<ConversationDetailWire>(`/chat/conversations/${id}`),
  });
}
