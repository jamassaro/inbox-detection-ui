import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/** Success body of `POST /billing/portal` (BE-030). */
export interface PortalSessionResponse {
  portalUrl: string;
}

/** TanStack mutation identity for the customer portal. */
export const PORTAL_MUTATION_KEY = ['billing', 'portal'] as const;

/**
 * Creates a Stripe Customer Portal session (`POST /billing/portal`, BE-030).
 * Empty body by design — the backend owns the portal return URL, so no
 * `returnUrl` is sent (FE-018.md's sketch predates the live contract). The
 * caller hands the browser over with a full-page redirect, same as Checkout.
 */
export async function createPortalSession(): Promise<PortalSessionResponse> {
  return apiFetch<PortalSessionResponse>('/billing/portal', { method: 'POST' });
}

/** Portal mutation used by the billing page's "Manage subscription" button. */
export function useCustomerPortal() {
  return useMutation({
    mutationKey: PORTAL_MUTATION_KEY,
    mutationFn: createPortalSession,
  });
}
