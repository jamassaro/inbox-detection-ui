import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CreditCard, ExternalLink, TrendingUp } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SkeletonListItem from '../components/SkeletonListItem';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { formatCurrency, formatDate } from '../lib/formatting';
import { getBillingCycleKey, getInitials } from '../lib/discoveryHelpers';
import type { Subscription } from '../types';

/** Number of skeleton rows shown while the first fetch is in flight. */
const LOADING_SKELETONS = 5;

/** Wire statuses with a translation; anything else renders no status row. */
const KNOWN_STATUSES = ['active', 'cancelled', 'unknown'];

/** Only plain hostnames become links — the domain is backend data, never trusted as a URL. */
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{children}</dd>
  </div>
);

interface SubscriptionRowProps {
  subscription: Subscription;
}

const SubscriptionRow = ({ subscription }: SubscriptionRowProps) => {
  const { t: tSub, i18n } = useTranslation('subscriptions');
  const { t: tBilling } = useTranslation('billing');
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const cycleKey = getBillingCycleKey(subscription.billingCycle);
  const locale = i18n.language;
  const hasAmount = subscription.currentAmount != null && !!subscription.currency;
  const domain = subscription.domain && HOSTNAME_PATTERN.test(subscription.domain) ? subscription.domain : null;
  const status = KNOWN_STATUSES.includes(subscription.status) ? subscription.status : null;

  return (
    <div data-testid="subscription-row">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={tSub(expanded ? 'detail.hide' : 'detail.show', { company: subscription.company })}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        {/* Initials avatar */}
        <div
          className="w-10 h-10 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold shrink-0"
          aria-hidden="true"
        >
          {getInitials(subscription.company)}
        </div>

        {/* Company, plan, amount + billing cycle */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{subscription.company}</div>
          {/* Plan/tier name is AI-extracted — rendered as-is; null for rows detected before it was extracted */}
          {subscription.plan && (
            <div className="text-sm text-gray-500 truncate" data-testid="subscription-plan">
              {subscription.plan}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
            {hasAmount && (
              <span>
                {formatCurrency(subscription.currentAmount!, subscription.currency!, locale)}
                {cycleKey && ` / ${tBilling(cycleKey)}`}
              </span>
            )}
            {subscription.nextBillingDate && (
              <span>{tSub('list.renewsOn', { date: formatDate(subscription.nextBillingDate, locale) })}</span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Inline details — every value comes from the existing records response */}
      {expanded && (
        <dl
          id={detailsId}
          data-testid="subscription-details"
          className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 bg-gray-50 px-4 py-4 sm:grid-cols-3"
        >
          {subscription.plan && <DetailItem label={tSub('detail.plan')}>{subscription.plan}</DetailItem>}
          {hasAmount && (
            <DetailItem label={tSub('detail.amount')}>
              {formatCurrency(subscription.currentAmount!, subscription.currency!, locale)}
              {cycleKey && ` / ${tBilling(cycleKey)}`}
            </DetailItem>
          )}
          {subscription.monthlyEquivalent != null && subscription.currency && (
            <DetailItem label={tSub('detail.monthlyCost')}>
              {formatCurrency(subscription.monthlyEquivalent, subscription.currency, locale)}
            </DetailItem>
          )}
          {subscription.annualCost != null && subscription.currency && (
            <DetailItem label={tSub('detail.annualCost')}>
              {formatCurrency(subscription.annualCost, subscription.currency, locale)}
            </DetailItem>
          )}
          {subscription.nextBillingDate && (
            <DetailItem label={tSub('detail.nextBilling')}>
              {formatDate(subscription.nextBillingDate, locale)}
            </DetailItem>
          )}
          {status && <DetailItem label={tSub('detail.status')}>{tSub(`detail.statuses.${status}`)}</DetailItem>}
          {subscription.lastDetectedAt && (
            <DetailItem label={tSub('detail.lastDetected')}>
              {formatDate(subscription.lastDetectedAt, locale)}
            </DetailItem>
          )}
          {domain && (
            <DetailItem label={tSub('detail.website')}>
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-900 underline hover:text-gray-700"
              >
                {domain}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </DetailItem>
          )}
        </dl>
      )}
    </div>
  );
};

/**
 * Subscriptions page (FE-025): summary totals at the top, then the full
 * list of detected recurring charges from `GET /subscriptions`.
 */
const SubscriptionsPage = () => {
  const { t } = useTranslation('subscriptions');
  const { i18n } = useTranslation();
  const { data, isPending, isError, refetch } = useSubscriptions();

  const subscriptions = useMemo(() => data?.subscriptions ?? [], [data]);

  // The backend totals carry no currency, so they are only shown when every
  // subscription shares one — summing across currencies would be wrong.
  const totalsCurrency = useMemo(() => {
    const currencies = new Set(subscriptions.map((sub) => sub.currency).filter(Boolean));
    return currencies.size === 1 ? [...currencies][0]! : null;
  }, [subscriptions]);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

        {/* Summary cards — only shown when we have data */}
        {!isPending && !isError && subscriptions.length > 0 && data && totalsCurrency && (
          <div className="grid grid-cols-2 gap-4" data-testid="summary-totals">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                <span>{t('summary.monthlyTotal', { amount: formatCurrency(data.summary.monthlyTotal, totalsCurrency, i18n.language) })}</span>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                <span>{t('summary.annualTotal', { amount: formatCurrency(data.summary.annualTotal, totalsCurrency, i18n.language) })}</span>
              </div>
            </div>
          </div>
        )}

        {/* List card */}
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {isPending && (
            <div className="px-4 py-2" data-testid="loading-skeletons">
              {Array.from({ length: LOADING_SKELETONS }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <SkeletonListItem key={i} />
              ))}
            </div>
          )}

          {isError && (
            <div className="p-6">
              <ErrorState
                title={t('error.title')}
                onRetry={() => void refetch()}
              />
            </div>
          )}

          {!isPending && !isError && subscriptions.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={CreditCard}
                title={t('empty.title')}
                description={t('empty.description')}
              />
            </div>
          )}

          {!isPending && !isError && subscriptions.map((sub) => (
            <SubscriptionRow key={sub.id} subscription={sub} />
          ))}
        </div>
      </div>
    </main>
  );
};

export default SubscriptionsPage;

