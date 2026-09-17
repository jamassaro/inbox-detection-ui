import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Purchasable plan intervals. The UI's selection only — Stripe owns the
 * actual prices (FE-016: pricing is presentational, never entitlement logic).
 */
export type BillingPlan = 'monthly' | 'annual';

/** Success body of `POST /billing/checkout` (BE-030). */
export interface CheckoutSessionResponse {
  checkoutUrl: string;
}

/** TanStack mutation identity for checkout. */
export const CHECKOUT_MUTATION_KEY = ['billing', 'checkout'] as const;

/** Env var holding the Stripe price ID for a plan. */
function envKeyFor(plan: BillingPlan): 'VITE_STRIPE_PRICE_MONTHLY_ID' | 'VITE_STRIPE_PRICE_ANNUAL_ID' {
  return plan === 'monthly'
    ? 'VITE_STRIPE_PRICE_MONTHLY_ID'
    : 'VITE_STRIPE_PRICE_ANNUAL_ID';
}

/**
 * Stripe price IDs are environment configuration (FE-016 agent notes: never
 * hardcoded in the frontend). The backend re-validates the submitted ID
 * against its own whitelist (BE-030) — a stale frontend copy fails there.
 */
export function resolvePriceId(plan: BillingPlan): string | null {
  const priceId = import.meta.env[envKeyFor(plan)];
  return typeof priceId === 'string' && priceId.length > 0 ? priceId : null;
}

/**
 * Creates the Stripe Checkout session (`POST /billing/checkout`, BE-030) and
 * returns its hosted URL. Pure server interaction — the caller decides how
 * to hand the browser over (UpgradePage does a full-page redirect, since
 * checkout happens on Stripe's own domain, never client-side routing).
 */
export async function createCheckoutSession(plan: BillingPlan): Promise<CheckoutSessionResponse> {
  const priceId = resolvePriceId(plan);
  if (!priceId) {
    throw new Error(
      `Stripe price ID for the ${plan} plan is not configured (${envKeyFor(plan)}). ` +
        'Set it in your environment (see .env.example).',
    );
  }
  return apiFetch<CheckoutSessionResponse>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ priceId }),
  });
}

/**
 * Checkout mutation used by the upgrade page. Failure states (missing price
 * config, network, backend 4xx/5xx) surface through the mutation's error
 * state for the caller to render — never silently.
 */
export function useCreateCheckout() {
  return useMutation({
    mutationKey: CHECKOUT_MUTATION_KEY,
    mutationFn: createCheckoutSession,
  });
}
