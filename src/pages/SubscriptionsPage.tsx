import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CreditCard, TrendingUp } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SkeletonListItem from '../components/SkeletonListItem';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { formatCurrency, formatDate } from '../lib/formatting';
import type { Subscription, SubscriptionFrequency } from '../types';

/** Number of skeleton rows shown while the first fetch is in flight. */
const LOADING_SKELETONS = 5;

/** Convert a subscription's amount to a monthly rate for summary totals. */
function toMonthlyRate(amount: number, frequency: SubscriptionFrequency): number {
  if (frequency === 'annual') return amount / 12;
  if (frequency === 'weekly') return (amount * 52) / 12;
  return amount;
}

/** Convert a subscription's amount to an annual rate for summary totals. */
function toAnnualRate(amount: number, frequency: SubscriptionFrequency): number {
  if (frequency === 'monthly') return amount * 12;
  if (frequency === 'weekly') return amount * 52;
  return amount;
}

interface SubscriptionRowProps {
  subscription: Subscription;
}

const SubscriptionRow = ({ subscription }: SubscriptionRowProps) => {
  const { t: tSub, i18n } = useTranslation('subscriptions');
  const { t: tBilling } = useTranslation('billing');
  const navigate = useNavigate();

  const handleClick = () => {
    if (subscription.discoveryId) {
      navigate(`/app/discoveries/${subscription.discoveryId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (subscription.discoveryId && (e.key === 'Enter' || e.key === ' ')) {
      navigate(`/app/discoveries/${subscription.discoveryId}`);
    }
  };

  return (
    <div
      data-testid="subscription-row"
      role={subscription.discoveryId ? 'button' : undefined}
      tabIndex={subscription.discoveryId ? 0 : undefined}
      onClick={subscription.discoveryId ? handleClick : undefined}
      onKeyDown={subscription.discoveryId ? handleKeyDown : undefined}
      className={`flex items-center gap-4 px-4 py-3 ${subscription.discoveryId ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
    >
      {/* Initials avatar */}
      <div
        className="w-10 h-10 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold shrink-0"
        aria-hidden="true"
      >
        {subscription.companyInitials}
      </div>

      {/* Company, product, amount + frequency */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{subscription.company}</div>
        {subscription.product && (
          <div className="text-sm text-gray-500 truncate">{subscription.product}</div>
        )}
        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
          <span>
            {formatCurrency(subscription.currentAmount, subscription.currency, i18n.language)}
            {' / '}
            {tBilling(`frequency.${subscription.frequency}`)}
          </span>
          {subscription.nextRenewal && (
            <span>{tSub('list.renewsOn', { date: formatDate(subscription.nextRenewal, i18n.language) })}</span>
          )}
        </div>
      </div>

      {/* Price changed badge */}
      {subscription.previousAmount != null && (
        <span
          data-testid="price-changed-badge"
          className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
        >
          {tSub('list.priceChanged')}
        </span>
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

  const { monthlyTotal, annualTotal } = useMemo(() => {
    let monthly = 0;
    let annual = 0;
    for (const sub of subscriptions) {
      monthly += toMonthlyRate(sub.currentAmount, sub.frequency);
      annual += toAnnualRate(sub.currentAmount, sub.frequency);
    }
    return { monthlyTotal: monthly, annualTotal: annual };
  }, [subscriptions]);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

        {/* Summary cards — only shown when we have data */}
        {!isPending && !isError && subscriptions.length > 0 && (
          <div className="grid grid-cols-2 gap-4" data-testid="summary-totals">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                <span>{t('summary.monthlyTotal', { amount: formatCurrency(monthlyTotal, 'USD', i18n.language) })}</span>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                <span>{t('summary.annualTotal', { amount: formatCurrency(annualTotal, 'USD', i18n.language) })}</span>
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

