import { createContext } from 'react';
import type { Entitlements } from '../types';

/** TanStack Query cache key holding the signed-in user's entitlements. */
export const ENTITLEMENTS_QUERY_KEY = ['entitlements'] as const;

/**
 * Pure: consumes one Detective Chat question after an accepted `POST /chat`
 * turn. Clamps at 0 and leaves null (Pro = unlimited, or unknown while
 * loading) untouched. A display estimate only — the chat endpoint's 402
 * pro_required error stays the enforcement source of truth.
 */
export function decrementChatQuestionsRemaining(entitlements: Entitlements): Entitlements {
  const { chatQuestionsRemaining } = entitlements;
  if (chatQuestionsRemaining === null) return entitlements;
  return {
    ...entitlements,
    chatQuestionsRemaining: Math.max(0, chatQuestionsRemaining - 1),
  };
}

export interface EntitlementContextValue {
  /** Null while unauthenticated, loading, or when the fetch fails. */
  entitlements: Entitlements | null;
  isLoading: boolean;
  /** Re-fetches GET /billing/status and updates the shared cache (FE-017). */
  refresh: () => Promise<void>;
  /**
   * Client-side display decrement of the shared chat-question counter after a
   * successful POST /chat (PR #28 follow-up). No-op when the cache is empty
   * (unauthenticated, or the status fetch failed). The counter re-seeds from
   * the static daily allowance (`detectiveChatLimit`) whenever /billing/status
   * is re-fetched — a new session or `refresh()` — so it is not persisted
   * across page loads.
   */
  decrementChatQuestions: () => void;
}

export const EntitlementContext = createContext<EntitlementContextValue | null>(null);
