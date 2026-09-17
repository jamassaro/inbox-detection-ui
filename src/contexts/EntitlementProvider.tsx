import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { BILLING_STATUS_PATH, mapBillingStatusToEntitlements } from '../lib/entitlementsMapper';
import { useAuth } from '../hooks/useAuth';
import { EntitlementContext, ENTITLEMENTS_QUERY_KEY } from './entitlementContext';
import type { BillingStatusWire, Entitlements } from '../types';

/**
 * Plan + feature flags from the backend, cached in TanStack Query under
 * ['entitlements']. Fetches GET /billing/status (BE-030) only while
 * authenticated — an unauthenticated session never triggers the request (no
 * 401 churn), and entitlements stay null. The wire body is mapped onto the
 * frontend Entitlements shape by mapBillingStatusToEntitlements.
 */
export const EntitlementProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    queryFn: async (): Promise<Entitlements> =>
      mapBillingStatusToEntitlements(await apiFetch<BillingStatusWire>(BILLING_STATUS_PATH)),
    enabled: isAuthenticated,
  });

  const refresh = useCallback(async () => {
    // Invalidation refetches the active ['entitlements'] query and resolves
    // once fresh data is in the cache — the checkout return (FE-017) will
    // await this after Stripe redirects back. No-op while unauthenticated:
    // the query is disabled and there is nothing to refresh.
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
