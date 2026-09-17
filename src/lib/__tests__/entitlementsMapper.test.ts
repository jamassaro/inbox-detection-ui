import { describe, expect, it } from 'vitest';
import { BILLING_STATUS_PATH, mapBillingStatusToEntitlements } from '../entitlementsMapper';
import type { BillingStatusWire } from '../../types';

/**
 * Wire fixtures verified against Inbox-api source: src/api/routes/billing.routes.ts
 * (GET /billing/status) + src/lib/entitlements.ts PLAN_ENTITLEMENTS (BE-012).
 * `Infinity` limits serialize to `null` over JSON, so Pro's limits arrive null.
 */
const freeStatus = (overrides: Partial<BillingStatusWire> = {}): BillingStatusWire => ({
  plan: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 500,
    visibleDiscoveryLimit: 5,
    continuousMonitoring: false,
    reminders: false,
    calendarActions: false,
    emailActions: false,
    detectiveChatLimit: 3,
    historicalComparison: false,
    dailyBriefing: false,
    fullDiscoveryHistory: false,
  },
  ...overrides,
});

const proStatus = (): BillingStatusWire => ({
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 2000,
    visibleDiscoveryLimit: null,
    continuousMonitoring: true,
    reminders: true,
    calendarActions: true,
    emailActions: true,
    detectiveChatLimit: null,
    historicalComparison: true,
    dailyBriefing: true,
    fullDiscoveryHistory: true,
  },
});

describe('mapBillingStatusToEntitlements', () => {
  it('targets the live backend surface (BE-030), not the retired /user/entitlements', () => {
    expect(BILLING_STATUS_PATH).toBe('/billing/status');
    expect(BILLING_STATUS_PATH).not.toBe('/user/entitlements');
  });

  it('maps a Free user — the daily chat limit becomes chatQuestionsRemaining', () => {
    expect(mapBillingStatusToEntitlements(freeStatus())).toEqual({
      plan: 'free',
      visibleDiscoveries: 5,
      continuousMonitoring: false,
      reminders: false,
      calendarActions: false,
      emailActions: false,
      dailyBriefing: false,
      chatQuestionsRemaining: 3,
    });
  });

  it('maps a Pro user — null wire limits stay null (unlimited, never fabricated)', () => {
    expect(mapBillingStatusToEntitlements(proStatus())).toEqual({
      plan: 'pro',
      visibleDiscoveries: null,
      continuousMonitoring: true,
      reminders: true,
      calendarActions: true,
      emailActions: true,
      dailyBriefing: true,
      chatQuestionsRemaining: null,
    });
  });

  it('degrades missing fields: booleans to false, numeric limits to null', () => {
    // Wire responses are not statically guaranteed — a degraded backend must
    // never grant features. The cast simulates a wire body with the
    // entitlements map missing entirely.
    const degraded = {
      plan: 'pro',
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: null,
    } as BillingStatusWire;

    expect(mapBillingStatusToEntitlements(degraded)).toEqual({
      plan: 'pro',
      visibleDiscoveries: null,
      continuousMonitoring: false,
      reminders: false,
      calendarActions: false,
      emailActions: false,
      dailyBriefing: false,
      chatQuestionsRemaining: null,
    });
  });

  it('coerces an unknown plan string to free (fail closed, mirrors backend asPlan)', () => {
    // The backend's asPlan already coerces; the mapper repeats the policy so
    // a contract drift can never surface a plan the user does not have.
    const status = freeStatus({ plan: 'enterprise' as BillingStatusWire['plan'] });
    const mapped = mapBillingStatusToEntitlements(status);
    expect(mapped.plan).toBe('free');
    expect(mapped.continuousMonitoring).toBe(false);
  });

  it('ignores non-numeric limit values instead of inventing a count', () => {
    const wire = freeStatus();
    // A degraded wire body can omit the limit fields entirely — hand the
    // mapper a runtime object missing them (hence the widened cast).
    const status = {
      ...wire,
      entitlements: {
        ...wire.entitlements,
        detectiveChatLimit: undefined,
        visibleDiscoveryLimit: undefined,
      },
    } as unknown as BillingStatusWire;

    const mapped = mapBillingStatusToEntitlements(status);
    expect(mapped.chatQuestionsRemaining).toBeNull();
    expect(mapped.visibleDiscoveries).toBeNull();
  });
});
