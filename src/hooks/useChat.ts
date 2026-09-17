import { useContext, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/apiError';
import { EntitlementContext } from '../contexts/entitlementContext';

/**
 * Detective Chat hook (FE-022).
 *
 * Wire contract — verified against Inbox-api BE-037 (src/api/routes/chat.routes.ts,
 * mounted at `app.use('/chat', …)` in src/api/server.ts):
 *
 * - `POST /chat` body `{ message }` → 200 `{ response, sources }`.
 *   FE-022.md writes `POST /chat/messages` returning `{ answer }` — the live
 *   backend mounts a single route at `/chat` and answers with `response`;
 *   the backend wins.
 * - `sources` rows are `{ id, title, type }` and always reference Discoveries
 *   (top 3 active discoveries used as grounding context). The ticket's
 *   `discoveryId / emailId / label` union does not exist on the wire.
 * - Free plan daily limit → 402 `{ error: 'pro_required' }` (BE-012). LLM
 *   synthesis failure → 502 `{ error: 'chat_unavailable' }`.
 * - There is NO history endpoint — the ticket's `GET /chat/messages` is not
 *   implemented server-side, so conversations start empty on every mount.
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

/** Wire body of `POST /chat` (BE-037). */
export interface ChatAnswerWire {
  response: string;
  sources: ChatSource[];
}

/** One chat turn as rendered by ChatPage. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'detective';
  /** AI-generated for the detective role — rendered as-is, never through t(). */
  content: string;
  sources?: ChatSource[];
  timestamp: string;
}

/** True when the backend rejected the question with the Free-plan limit error (402). */
export function isLimitReachedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402;
}

let idCounter = 0;
const nextMessageId = (): string => `msg-${Date.now().toString(36)}-${(idCounter += 1)}`;

export interface UseChatResult {
  messages: ChatMessage[];
  /** Appends the user turn optimistically, then POSTs it. Empty/whitespace is ignored. */
  send: (content: string) => void;
  /** Re-sends the most recent message (used by the inline ErrorState retry). */
  retry: () => void;
  /** True while `POST /chat` is in flight. */
  isLoading: boolean;
  error: ApiError | null;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const lastSentRef = useRef<string | null>(null);
  // Null-safe by design: outside an EntitlementProvider (isolated hook use,
  // tests) there is no shared counter and the hook still works.
  const entitlements = useContext(EntitlementContext);

  const mutation = useMutation({
    mutationFn: async (content: string): Promise<ChatMessage> => {
      const wire = await apiFetch<ChatAnswerWire>(CHAT_PATH, {
        method: 'POST',
        body: JSON.stringify({ message: content }),
      });
      return {
        id: nextMessageId(),
        role: 'detective',
        content: wire.response,
        sources: wire.sources,
        timestamp: new Date().toISOString(),
      };
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
      onSuccess: (detectiveMessage) => {
        setError(null);
        setMessages((prev) => [...prev, detectiveMessage]);
        // One accepted turn = one question consumed from the shared cache
        // (display estimate; the 402 pro_required error enforces the real
        // limit). Failed turns never decrement — only successful POSTs do.
        entitlements?.decrementChatQuestions();
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

  return { messages, send, retry, isLoading: mutation.isPending, error };
}
