import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { useBillingStatus } from '../../hooks/useBillingStatus';
import { useCustomerPortal } from '../../hooks/useCustomerPortal';
import { useLocale } from '../../hooks/useLocale';
import { useUpgradeRedirect } from '../../hooks/useUpgradeRedirect';
import { ENTITLEMENTS_QUERY_KEY } from '../../contexts/entitlementContext';
import { formatDate, formatCurrency } from '../../lib/formatting';
import {
  ANNUAL_PRICE,
  MONTHLY_PRICE,
  PLAN_CURRENCY,
  PRICE_LOCALE,
} from '../../lib/billingConfig';
import ErrorState from '../../components/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner';
import SkeletonCard from '../../components/SkeletonCard';

/**
 * Pro features a Free plan does not include, in render order — keys mirror
 * the shared requiresPro.feature.* labels so both surfaces translate
 * identically (FE-018).
 */
const FREE_EXCLUDED_FEATURES = [
  'continuousMonitoring',
  'reminders',
  'calendarActions',
  'emailActions',
  'dailyBriefing',
] as const;

/**
 * Billing settings page (FE-018). Pro users see plan, subscription status,
 * renewal date, and a Stripe Customer Portal hand-off; Free users see their
 * plan status with an upgrade CTA that preserves the billing-page context
 * for post-checkout restoration. The page never rebuilds Stripe's UI —
 * payment method and invoices live in the portal.
 */
const BillingPage = () => {
  const { t } = useTranslation('billing');
  const { locale } = useLocale();
  const { status, subscriptionState, isLoading, isError, refetch } = useBillingStatus();
  const portal = useCustomerPortal();
  const { redirectToUpgrade } = useUpgradeRedirect();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Portal return (FE-018): the Stripe portal can cancel, reactivate, or
  // change the plan — invalidate entitlements so every feature gate reflects
  // it immediately. Billing status itself refetches on every mount.
  useEffect(() => {
    if (searchParams.get('portal_return') === 'true') {
      void queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
    }
  }, [searchParams, queryClient]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6" data-testid="billing-page">
        <div data-testid="billing-skeleton">
          <SkeletonCard lines={4} />
        </div>
        <div className="mt-4">
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="mx-auto max-w-2xl p-6" data-testid="billing-page">
        <h1 className="text-2xl font-bold text-gray-900">{t('billingPage.title')}</h1>
        <div className="mt-6" data-testid="billing-error">
          <ErrorState
            title={t('billingPage.loadErrorTitle')}
            description={t('billingPage.loadErrorDescription')}
            onRetry={() => {
              void refetch();
            }}
          />
        </div>
      </div>
    );
  }

  const isPro = status.plan === 'pro';
  const periodEnd = status.currentPeriodEnd;
  const periodEndDate = periodEnd ? formatDate(periodEnd, locale) : null;

  const openPortal = () => {
    portal.mutate(undefined, {
      // The portal is Stripe-hosted — full-page redirect, never client-side
      // routing (same pattern as Checkout, FE-018 agent notes).
      onSuccess: ({ portalUrl }) => window.location.assign(portalUrl),
    });
  };

  return (
    <div className="mx-auto max-w-2xl p-6" data-testid="billing-page">
      <h1 className="text-2xl font-bold text-gray-900">{t('billingPage.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('billingPage.subtitle')}</p>

      {isPro ? (
        <section
          aria-label={t('billingPage.title')}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {t('billingPage.planLabel')}
              </h2>
              {/* "Pro" is the brand plan name — no interval is known here (the
                  backend owns the Stripe price), so no monthly/annual suffix. */}
              <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="billing-plan-value">
                Pro
              </p>
            </div>
            {subscriptionState && (
              <span
                data-testid="billing-status-badge"
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  subscriptionState === 'cancelling'
                    ? 'border border-yellow-200 bg-yellow-50 text-yellow-800'
                    : subscriptionState === 'expired'
                      ? 'border border-red-200 bg-red-50 text-red-800'
                      : 'border border-green-200 bg-green-50 text-green-800'
                }`}
              >
                {t(`billingPage.status.${subscriptionState}`)}
              </span>
            )}
          </div>

          {status.cancelAtPeriodEnd && periodEndDate && (
            <div
              role="status"
              data-testid="cancel-warning"
              className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{t('billingPage.cancelWarning', { date: periodEndDate })}</p>
            </div>
          )}

          <dl className="mt-6 space-y-3 text-sm">
            {periodEndDate && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">{t('billingPage.renewalLabel')}</dt>
                <dd data-testid="billing-renewal" className="font-medium text-gray-900">
                  {subscriptionState === 'cancelling'
                    ? t('billingPage.endsOn', { date: periodEndDate })
                    : periodEndDate}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">{t('billingPage.monthlyCost')}</dt>
              <dd data-testid="billing-price-monthly" className="font-medium text-gray-900">
                {formatCurrency(MONTHLY_PRICE, PLAN_CURRENCY, PRICE_LOCALE)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">{t('billingPage.annualCost')}</dt>
              <dd data-testid="billing-price-annual" className="font-medium text-gray-900">
                {formatCurrency(ANNUAL_PRICE, PLAN_CURRENCY, PRICE_LOCALE, {
                  maximumFractionDigits: 0,
                })}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <button
              type="button"
              onClick={openPortal}
              disabled={portal.isPending}
              data-testid="manage-subscription"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {portal.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              )}
              {t('billingPage.manageSubscription')}
            </button>
            {portal.isError && (
              <p
                role="alert"
                data-testid="portal-error"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {t('billingPage.portalError')}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section
          aria-label={t('billingPage.title')}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {t('billingPage.planLabel')}
              </h2>
              <p className="mt-1 text-2xl font-bold text-gray-900" data-testid="billing-plan-value">
                {t('upgradePage.plans.free.name')}
              </p>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-gray-900">
            {t('billingPage.freeView.featuresHeading')}
          </h3>
          <ul className="mt-2 space-y-2">
            {FREE_EXCLUDED_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <span>{t(`requiresPro.feature.${feature}`)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => redirectToUpgrade({ source: 'billing_page' })}
              data-testid="billing-free-cta"
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              {t('upgrade.cta')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default BillingPage;
