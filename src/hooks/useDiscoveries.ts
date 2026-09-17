import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { toDiscovery } from '../lib/discoveryWire';
import type { DiscoveriesWire } from '../lib/discoveryWire';
import type { DiscoveryListResponse } from '../types';

/**
 * Discoveries feed hooks (FE-013).
 *
 * Wire contract — verified against Inbox-api BE-028
 * (src/api/routes/discoveries.routes.ts, read 2026-09-17):
 *
 * - `GET /discoveries` accepts ONLY `type`, `status` (default "active";
 *   empty string = all), `limit` (0–100, default 20), `offset`, and
 *   `investigationId`. FE-013.md's `search` and `page` params do not exist
 *   server-side — tabs/search filter the fetched window client-side
 *   (see lib/discoveryFilters.ts and the PR's backend-delta notes).
 * - Response: `{ discoveries, total, lockedCount, pagination }`, rows
 *   already entitlement-masked for Free users (locked rows carry
 *   `isLocked: true`, narrative fields null, `availableActions: ['upgrade']`).
 * - Dismiss is `PATCH /discoveries/:id/dismiss` with an EMPTY body — NOT
 *   `PATCH /:id { status: 'dismissed' }` as the ticket writes (BE-036
 *   strict validation rejects any supplied field).
 * - Feedback is `PATCH /discoveries/:id/feedback` with
 *   `{ feedback: 'useful' | 'not_useful' | 'never_this_type' }` — NOT POST.
 */

/** Path prefix of the discoveries endpoints (BE-028). */
export const DISCOVERIES_PATH = '/discoveries';

/** Rows fetched per query — the backend caps limit at 100 (BE-028). */
export const DISCOVERIES_PAGE_SIZE = 100;

/** Parameters accepted by {@link useDiscoveries} — the backend's real ones. */
export interface DiscoveriesQueryParams {
  /** Backend discovery type (wire value), when filtering by type. */
  type?: string;
  /** Backend status filter; the backend defaults to "active" when omitted. */
  status?: string;
}

/** Builds the query string for GET /discoveries — unset values are omitted. */
export function buildDiscoveriesPath(params: DiscoveriesQueryParams): string {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.status !== undefined) search.set('status', params.status);
  search.set('limit', String(DISCOVERIES_PAGE_SIZE));
  const qs = search.toString();
  return qs === '' ? DISCOVERIES_PATH : `${DISCOVERIES_PATH}?${qs}`;
}

/** Normalized list result: domain rows plus the backend's real metadata. */
export interface DiscoveriesResult extends DiscoveryListResponse {
  /** Unfiltered total for the user (NOT scoped by filters — BE-028). */
  total: number;
}

/** Cache key of every GET /discoveries entry (`['discoveries', params]`). */
export const DISCOVERIES_QUERY_KEY = ['discoveries'] as const;

function toListResponse(wire: DiscoveriesWire): DiscoveriesResult {
  return {
    items: wire.discoveries.map(toDiscovery),
    lockedCount: wire.lockedCount,
    total: wire.total,
  };
}

/**
 * Reads the authenticated user's discoveries via TanStack Query. The
 * response is entitlement-filtered by construction (the backend masks
 * locked rows and reports lockedCount), so no client-side plan logic is
 * needed or allowed here.
 */
export function useDiscoveries(params: DiscoveriesQueryParams = {}) {
  return useQuery<DiscoveriesWire, Error, DiscoveriesResult>({
    queryKey: [...DISCOVERIES_QUERY_KEY, params],
    queryFn: () => apiFetch<DiscoveriesWire>(buildDiscoveriesPath(params)),
    select: toListResponse,
    retry: false,
  });
}

/**
 * Dismisses a discovery with an optimistic list update:
 * `queryClient.setQueryData` removes the row from every cached discoveries
 * list immediately, and an error (401/404/500) restores the previous
 * snapshots. Both outcomes invalidate so the next render agrees with the
 * backend.
 */
export function useDismissDiscovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(`${DISCOVERIES_PATH}/${id}/dismiss`, { method: 'PATCH' }),
    onMutate: async (id) => {
      // Stop in-flight list fetches from clobbering the optimistic write.
      await queryClient.cancelQueries({ queryKey: DISCOVERIES_QUERY_KEY });
      const queries = queryClient
        .getQueryCache()
        .findAll({ queryKey: DISCOVERIES_QUERY_KEY });
      const snapshots: [QueryKey, DiscoveriesWire][] = [];
      for (const query of queries) {
        const previous = queryClient.getQueryData<DiscoveriesWire>(query.queryKey);
        // findAll prefix-matches every query under ['discoveries'] — including
        // FE-014's detail/evidence caches, whose cached value is a single wire
        // row, not a DiscoveriesWire. Only list-shaped queries are patched.
        if (previous === undefined || !Array.isArray(previous.discoveries)) continue;
        snapshots.push([query.queryKey, previous]);
        queryClient.setQueryData<DiscoveriesWire>(query.queryKey, {
          ...previous,
          discoveries: previous.discoveries.filter((wire) => wire.id !== id),
        });
      }
      return { snapshots };
    },
    onError: (_error, _id, context) => {
      for (const [key, value] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DISCOVERIES_QUERY_KEY });
    },
  });
}

/** Feedback values accepted by PATCH /discoveries/:id/feedback (BE-029). */
export type DiscoveryFeedbackValue = 'useful' | 'not_useful' | 'never_this_type';

/**
 * Records relevance feedback on a discovery. No optimistic cache write —
 * the row's rendered content does not change; invalidation keeps any cached
 * detail view consistent.
 */
export function useDiscoveryFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: DiscoveryFeedbackValue }) =>
      apiFetch<{ success: boolean }>(`${DISCOVERIES_PATH}/${id}/feedback`, {
        method: 'PATCH',
        body: JSON.stringify({ feedback }),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DISCOVERIES_QUERY_KEY });
    },
  });
}
