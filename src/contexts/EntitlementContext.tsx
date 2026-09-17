import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { EntitlementContext, ENTITLEMENTS_QUERY_KEY } from './entitlementContext';
import type { Entitlements } from '../types';

/**
 * Plan + feature flags from the backend, cached in TanStack Query under
 * ['entitlements']. Fetches GET /user/entitlements only while authenticated —
 * an unauthenticated session never triggers the request (no 401 churn), and
 * entitlements stay null.
 */
export const EntitlementProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    queryFn: () => apiFetch<Entitlements>('/user/entitlements'),
    enabled: isAuthenticated,
  });

  const refresh = useCallback(async () => {
    // Invalidation refetches the active ['entitlements'] query and resolves
    // once fresh data is in the cache — UpgradeSuccessPage awaits this after
    // Stripe returns. No-op while unauthenticated: the query is disabled and
    // there is nothing to refresh.
    if (!isAuthenticated) return;
    await queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
  }, [isAuthenticated, queryClient]);

  const value = useMemo(
    () => ({
      // Fail closed on auth loss: never surface the previous user's plan.
      entitlements: isAuthenticated ? (data ?? null) : null,
      isLoading,
      refresh,
    }),
    [isAuthenticated, data, isLoading, refresh],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
};
