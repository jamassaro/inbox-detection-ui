import type { BillingEntitlementsWire, BillingStatusWire, Entitlements } from '../types';

/** Backend path of the billing status endpoint (BE-030). */
export const BILLING_STATUS_PATH = '/billing/status';

/** Absent entitlements map — degrade to an empty map so reads fail closed. */
const EMPTY_ENTITLEMENTS: Partial<BillingEntitlementsWire> = {};

/**
 * Maps the `GET /billing/status` wire body (BE-030) onto the frontend
 * Entitlements shape. Pure and fail-closed:
 * - unknown plan strings coerce to 'free' (mirrors the backend's asPlan),
 * - missing boolean flags degrade to false (never grant),
 * - missing numeric limits degrade to null (counters hide, never fabricated).
 *
 * Naming note: the wire has no per-question remaining count. The FE
 * `chatQuestionsRemaining` is backed by the static daily chat limit
 * (`detectiveChatLimit`: free 3/day, pro null = unlimited); actual exhaustion
 * is signaled by the chat endpoint's 402 pro_required error.
 */
export function mapBillingStatusToEntitlements(status: BillingStatusWire): Entitlements {
  const map: Partial<BillingEntitlementsWire> = status?.entitlements ?? EMPTY_ENTITLEMENTS;
  return {
    plan: status?.plan === 'pro' ? 'pro' : 'free',
    visibleDiscoveries:
      typeof map.visibleDiscoveryLimit === 'number' ? map.visibleDiscoveryLimit : null,
    continuousMonitoring: map.continuousMonitoring === true,
    reminders: map.reminders === true,
    calendarActions: map.calendarActions === true,
    emailActions: map.emailActions === true,
    dailyBriefing: map.dailyBriefing === true,
    chatQuestionsRemaining:
      typeof map.detectiveChatLimit === 'number' ? map.detectiveChatLimit : null,
  };
}
