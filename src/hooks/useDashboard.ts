import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { sumPotentialValue } from '../lib/potentialValue';
import { toDiscovery } from './useInvestigation';
import type { DiscoveriesWire, DiscoveryWire } from './useInvestigation';
import type { Discovery } from '../types';

/**
 * Dashboard hooks (FE-015).
 *
 * Backend reality (Inbox-api `src/api/routes/discoveries.routes.ts`, verified
 * 2026-09-17): `GET /discoveries` has NO `importance` filter — the FE-015
 * ticket's planned `?importance=high&limit=5` is not implementable as
 * written. The supported params are `type`, `status` (default "active"),
 * `limit` (max 100), `offset`, and `investigationId`. So the dashboard
 * fetches one real window of active discoveries (`status=active&limit=100`)
 * and derives priority client-side from the wire row's `priority` field
 * (`low|medium|high|urgent`) — the same field the backend already orders by
 * (`priority desc, createdAt desc`). Stats are likewise derived from that
 * window; `total` and `lockedCount` are unscoped aggregates the backend
 * reports alongside it.
 */

/** Cache key for the dashboard's discovery window (dismiss updates it optimistically). */
export const DASHBOARD_QUERY_KEY = ['discoveries', 'dashboard'] as const;

/** Window size for the client-side derivation — the backend caps `limit` at 100. */
export const DASHBOARD_WINDOW_LIMIT = 100;

/**
 * Urgency rank for ordering wire rows. Unknown priorities rank as 'medium'
 * (the backend column default), matching toDiscovery's fallback.
 */
const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

/**
 * True for rows that need the user's attention: the backend's two
 * high-urgency priorities (FE-011 maps both to 'high' importance).
 */
export function isHighPriority(wire: DiscoveryWire): boolean {
  return wire.priority === 'high' || wire.priority === 'urgent';
}

/** Summary stats for the dashboard, derived from the active window. */
export interface DashboardStats {
  /** Sums of real amounts in the window, one entry per currency. */
  moneyFound: { currency: string; amount: number }[];
  /** Active-window rows the backend classified as subscriptions. */
  subscriptionCount: number;
  /** Active-window rows with high/urgent priority. */
  needsAttentionCount: number;
}

/** Pure derivation of the dashboard's summary stats from the active window. */
export function deriveDashboardStats(window: DiscoveryWire[]): DashboardStats {
  return {
    moneyFound: sumPotentialValue(window),
    subscriptionCount: window.filter((row) => row.type === 'subscription').length,
    needsAttentionCount: window.filter(isHighPriority).length,
  };
}

/**
 * Pure selection of the dashboard's priority cards: unlocked rows, most
 * urgent first, capped at `max`. The sort is stable, so equal priorities
 * keep the backend's recency order (priority desc, createdAt desc). Rows
 * map through the shared toDiscovery adapter so the page can hand them
 * straight to DiscoveryCard (FE-012).
 */
export function selectPriorityDiscoveries(window: DiscoveryWire[], max = 5): Discovery[] {
  return window
    .filter((row) => !row.isLocked)
    .sort((a, b) => (PRIORITY_RANK[b.priority] ?? 1) - (PRIORITY_RANK[a.priority] ?? 1))
    .slice(0, max)
    .map(toDiscovery);
}

/** Everything the DashboardPage renders, derived from one discoveries window. */
export interface DashboardData {
  stats: DashboardStats;
  priorityDiscoveries: Discovery[];
  /** Backend `total` — all of the user's discoveries, every status (NOT scoped by the window). */
  totalDiscoveries: number;
  /** Backend `lockedCount` — rows hidden behind the paywall. */
  lockedCount: number;
  /** True when the active window is empty — the dashboard's empty state. */
  isEmpty: boolean;
}

const toDashboardData = (wire: DiscoveriesWire): DashboardData => ({
  stats: deriveDashboardStats(wire.discoveries),
  priorityDiscoveries: selectPriorityDiscoveries(wire.discoveries),
  totalDiscoveries: wire.total,
  lockedCount: wire.lockedCount,
  isEmpty: wire.discoveries.length === 0,
});

/**
 * Optimistic dismissal — `PATCH /discoveries/:id/dismiss` (the backend
 * route validates a strictly empty body). The row leaves the cached window
 * immediately, and comes back with fresh stats if the backend refuses.
 */
const useDismissDiscovery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DiscoveryWire>(`/discoveries/${id}/dismiss`, { method: 'PATCH' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_QUERY_KEY });
      const previous = queryClient.getQueryData<DiscoveriesWire>(DASHBOARD_QUERY_KEY);
      queryClient.setQueryData<DiscoveriesWire>(DASHBOARD_QUERY_KEY, (current) =>
        current
          ? { ...current, discoveries: current.discoveries.filter((row) => row.id !== id) }
          : current,
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DASHBOARD_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
  });
};

/**
 * Reads the dashboard's discovery window and derives everything the page
 * renders. `refetch` doubles as the error state's retry; `dismiss` is the
 * optimistic dismissal used by the discovery cards.
 *
 * `retry: false` matches the other discovery hooks: a failed load surfaces
 * immediately as the page's error state instead of three silent TanStack
 * retries stretching the wait.
 */
export function useDashboard() {
  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () =>
      apiFetch<DiscoveriesWire>(`/discoveries?status=active&limit=${DASHBOARD_WINDOW_LIMIT}`),
    retry: false,
  });

  const dismiss = useDismissDiscovery();

  return {
    data: query.data ? toDashboardData(query.data) : undefined,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    dismiss,
  };
}