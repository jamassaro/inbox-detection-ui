import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useEntitlements } from '../hooks/useEntitlements';
import { useCreateCheckout } from '../hooks/useCheckout';
import type { BillingPlan } from '../hooks/useCheckout';
import { formatCurrency } from '../lib/formatting';
import {
  ANNUAL_PRICE,
  MONTHLY_PRICE,
  PLAN_CURRENCY,
  PRICE_LOCALE,
} from '../lib/billingConfig';

/**
 * Paywall sources with a contextual headline (FE-016). The `?from=` query
 * param is a UI display hint only — unknown or missing values fall back to
 * the default headline and never affect backend behavior.
 */
const CONTEXTUAL_SOURCES = [
  'locked_discovery',
  'reminder',
  'calendar',
  'chat_limit',
  'investigation_results',
] as const;

type ContextualSource = (typeof CONTEXTUAL_SOURCES)[number];

const isContextualSource = (value: string | null): value is ContextualSource =>
  value !== null && (CONTEXTUAL_SOURCES as readonly string[]).includes(value);

/** Feature bullets on the Free plan card, in render order. */
const FREE_FEATURES = ['investigation', 'discoveries', 'chat', 'refresh'] as const;

/** Feature bullets on the Pro plan cards, in render order. */
const PRO_FEATURES = ['monitoring', 'discoveries', 'reminders', 'calendar', 'chat', 'briefing'] as const;

/**
 * Presentational plan pricing only — Stripe is the source of truth; the
 * shared constants live in src/lib/billingConfig.ts so the billing page
 * renders the same numbers (FE-018).
 */
const PRICE_FORMAT_OPTIONS = { maximumFractionDigits: 0 } as const;

/** Plan card metadata for the comparison grid. */
const PLAN_CARDS: { plan: 'free' | BillingPlan; headingId: string }[] = [
  { plan: 'free', headingId: 'plan-free-heading' },
  { plan: 'monthly', headingId: 'plan-monthly-heading' },
  { plan: 'annual', headingId: 'plan-annual-heading' },
];

/**
 * Public pricing/upgrade page (FE-016). Shows a Free vs Pro plan comparison
 * with a contextual headline from `?from=`; the Pro CTA starts Stripe
 * Checkout via `POST /billing/checkout` (BE-030) — wiring only, the success/
 * cancel return leg is FE-017. Free users see pricing; Pro users see a
 * current-plan indicator instead of the CTA.
 */
const UpgradePage = () => {
  const { t } = useTranslation('billing');
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  // FE-017: Stripe returns here via /billing/cancelled after a cancelled
  // checkout. Reassure, and keep the saved upgrade context so a retry still
  // returns the user to their original context.
  const cancelled = searchParams.get('cancelled') === 'true';
  const { isPro, isFree } = useEntitlements();
  const checkout = useCreateCheckout();

  const headline = isContextualSource(from)
    ? t(`upgradePage.contextual.${from}`)
    : t('upgradePage.contextual.default');

  const monthlyPrice = formatCurrency(MONTHLY_PRICE, PLAN_CURRENCY, PRICE_LOCALE);
  const annualPrice = formatCurrency(ANNUAL_PRICE, PLAN_CURRENCY, PRICE_LOCALE, PRICE_FORMAT_OPTIONS);
  const freePrice = formatCurrency(0, PLAN_CURRENCY, PRICE_LOCALE, PRICE_FORMAT_OPTIONS);

  const handleUpgrade = (plan: BillingPlan) => {
    checkout.mutate(plan, {
      onSuccess: ({ checkoutUrl }) => {
        // Checkout happens on Stripe's own domain — full-page redirect,
        // never client-side routing (BE-030). The return leg is FE-017.
        window.location.assign(checkoutUrl);
      },
    });
  };

  const renderPrice = (plan: 'free' | BillingPlan) => {
    if (plan === 'free') {
      return <p className="mt-2 text-3xl font-bold text-gray-900">{freePrice}</p>;
    }
    const price = plan === 'monthly' ? monthlyPrice : annualPrice;
    const period = t(`frequency.${plan}`);
    return (
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {price}
        <span className="text-base font-normal text-gray-500">/{period}</span>
      </p>
    );
  };

  const renderCardAction = (plan: 'free' | BillingPlan) => {
    if (plan === 'free') {
      if (!isFree) return null;
      return (
        <span
          data-testid="current-plan-free"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
        >
          {t('upgradePage.plans.currentPlan')}
        </span>
      );
    }
    if (isPro) {
      return (
        <span
          data-testid="current-plan-pro"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
        >
          {t('upgradePage.plans.currentPlan')}
        </span>
      );
    }
    const isPending = checkout.isPending && checkout.variables === plan;
    return (
      <button
        type="button"
        onClick={() => handleUpgrade(plan)}
        disabled={checkout.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid={`upgrade-cta-${plan}`}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {t('upgradePage.plans.cta')}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900" data-testid="upgrade-headline">
          {headline}
        </h1>
        <p className="mt-2 text-gray-600">{t('upgradePage.subcopy')}</p>

        {cancelled && (
          <p
            role="status"
            data-testid="cancelled-notice"
            className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
          >
            {t('upgradePage.cancelledNotice')}
          </p>
        )}

        {checkout.isError && (
          <p
            role="alert"
            data-testid="checkout-error"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {t('upgradePage.errors.checkout')}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLAN_CARDS.map(({ plan, headingId }) => {
            const isAnnual = plan === 'annual';
            const nameKey =
              plan === 'free'
                ? 'upgradePage.plans.free.name'
                : plan === 'monthly'
                  ? 'upgradePage.plans.monthly.name'
                  : 'upgradePage.plans.annual.name';
            const features = plan === 'free' ? FREE_FEATURES : PRO_FEATURES;
            return (
              <section
                key={plan}
                aria-labelledby={headingId}
                data-testid={`plan-card-${plan}`}
                className={`relative rounded-xl border bg-white p-6 ${
                  isAnnual ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
                }`}
              >
                {isAnnual && (
                  <span
                    data-testid="save-badge"
                    className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t('upgradePage.plans.annual.saveBadge')}
                  </span>
                )}
                <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {t(nameKey)}
                </h2>
                {renderPrice(plan)}
                <ul className="mt-4 space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                      <span>
                        {t(
                          `upgradePage.plans.${plan === 'free' ? 'free' : 'pro'}.features.${feature}`,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">{renderCardAction(plan)}</div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          {t('upgradePage.alreadyPro')}{' '}
          <Link
            to="/app/settings/billing"
            data-testid="already-pro-link"
            className="font-medium text-gray-900 underline hover:text-gray-700"
          >
            {t('upgradePage.manageBilling')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default UpgradePage;
