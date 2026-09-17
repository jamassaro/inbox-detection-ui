import { useQuery } from '@tanstack/react-query';
import type { QueryObserverResult } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Entitlements } from '../types';

/** TanStack Query cache key for GET /billing/status (FE-018 portal-return invalidation). */
export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const;

/**
 * Wire body of GET /billing/status (BE-030, verified against the live
 * backend). `subscriptionStatus` is a free String column documented in
 * prisma/schema.prisma as "active" | "past_due" | "cancelled" | "trialing".
 */
export interface BillingStatusWire {
  plan: Entitlements['plan'];
  subscriptionStatus: string | null;
  /** ISO-8601 period end, when a subscription exists. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Entitlement map for the returned plan — informational; plan gating reads ['entitlements']. */
  entitlements?: Entitlements;
}

/** The three subscription states FE-018 renders for Pro users. */
export type SubscriptionUiState = 'active' | 'cancelling' | 'expired';

/**
 * Maps the wire row to the billing page's status badge. Cancel-at-period-end
 * wins over the raw status: a user who cancels mid-cycle still has an
 * 'active' subscription until the period ends, but the UI must say
 * "Cancelling", not "Active" (FE-018 agent notes). Unknown status strings
 * stay 'active' — the backend grants features by plan, so the badge must not
 * invent a terminal state it was never told about. Free plans have no
 * subscription to describe.
 */
export function toSubscriptionState(
  wire: Pick<BillingStatusWire, 'plan' | 'subscriptionStatus' | 'cancelAtPeriodEnd'>,
): SubscriptionUiState | null {
  if (wire.plan !== 'pro') return null;
  if (wire.cancelAtPeriodEnd) return 'cancelling';
  switch (wire.subscriptionStatus) {
    case 'cancelled':
      return 'expired';
    case 'active':
    case 'trialing':
    case 'past_due':
    case null:
      return 'active';
    default:
      return 'active';
  }
}

export interface UseBillingStatusResult {
  status: BillingStatusWire | null;
  subscriptionState: SubscriptionUiState | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<QueryObserverResult<BillingStatusWire>>;
}

/**
 * Reads GET /billing/status (BE-030) for the billing settings page. Mounted
 * only inside the authenticated app shell.
 */
export function useBillingStatus(): UseBillingStatusResult {
  const query = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: () => apiFetch<BillingStatusWire>('/billing/status'),
    // The billing page is the Stripe portal's return target: portal actions
    // (cancel, reactivate, plan change) must be visible immediately, so never
    // serve a stale cache on mount.
    refetchOnMount: 'always',
  });

  return {
    status: query.data ?? null,
    subscriptionState: query.data ? toSubscriptionState(query.data) : null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
