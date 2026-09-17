import { useContext, useMemo } from 'react';
import { EntitlementContext } from '../contexts/entitlementContext';
import type { EntitlementContextValue } from '../contexts/entitlementContext';
import type { Entitlements, ProFeature } from '../types';

/** A feature is available when the plan is Pro or the backend flags it on. */
const hasFeature = (entitlements: Entitlements | null, feature: ProFeature): boolean =>
  entitlements?.plan === 'pro' || entitlements?.[feature] === true;

export interface UseEntitlementsResult extends EntitlementContextValue {
  plan: Entitlements['plan'] | null;
  isPro: boolean;
  isFree: boolean;
  /** Single gate for boolean Pro features (AGENTS.md — plan is read nowhere else). */
  hasFeature: (feature: ProFeature) => boolean;
  canUseContinuousMonitoring: boolean;
  canUseReminders: boolean;
  canUseCalendar: boolean;
  canUseEmailActions: boolean;
  canUseDailyBriefing: boolean;
  /** Remaining Detective Chat questions; null = unlimited (or unknown while loading). */
  chatQuestionsRemaining: number | null;
}

/**
 * The only place in the codebase that checks plan or features (AGENTS.md).
 * Must be used within an EntitlementProvider.
 */
export const useEntitlements = (): UseEntitlementsResult => {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error('useEntitlements must be used within an EntitlementProvider');
  }

  return useMemo(() => {
    const { entitlements } = ctx;
    return {
      ...ctx,
      plan: entitlements?.plan ?? null,
      isPro: entitlements?.plan === 'pro',
      isFree: entitlements?.plan === 'free',
      hasFeature: (feature: ProFeature) => hasFeature(entitlements, feature),
      canUseContinuousMonitoring: hasFeature(entitlements, 'continuousMonitoring'),
      canUseReminders: hasFeature(entitlements, 'reminders'),
      canUseCalendar: hasFeature(entitlements, 'calendarActions'),
      canUseEmailActions: hasFeature(entitlements, 'emailActions'),
      canUseDailyBriefing: hasFeature(entitlements, 'dailyBriefing'),
      chatQuestionsRemaining: entitlements?.chatQuestionsRemaining ?? null,
    };
  }, [ctx]);
};
