import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DiscoveryCard from '../../components/DiscoveryCard';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner';
import LockedDiscoveryCard from '../../components/LockedDiscoveryCard';
import { useLocale } from '../../hooks/useLocale';
import {
  toDiscovery,
  useInvestigation,
  useInvestigationDiscoveries,
} from '../../hooks/useInvestigation';
import { formatCurrency, formatNumber } from '../../lib/formatting';
import { sumPotentialValue } from '../../lib/potentialValue';
import type { Discovery, DiscoveryAction } from '../../types';

/**
 * Investigation results step of onboarding (FE-009) — the first look at what
 * the investigation found. Reads `GET /discoveries` (entitlement-filtered by
 * the backend: masked locked rows + lockedCount), renders the summary block
 * and the first discovery cards via the FE-012 card system, and hands off to
 * the full app.
 *
 * Honesty rules:
 *  - "Emails analyzed" comes from the completed Investigation row (via
 *    `?investigationId=`); when the row is unavailable the stat is omitted —
 *    a placeholder zero is never shown.
 *  - "Potential value" sums the real amounts of the returned discoveries,
 *    grouped per currency.
 */

const DISCOVERIES_PATH = '/app/discoveries';
const UPGRADE_PATH = '/upgrade?from=investigation_results';

/** Summary strip: emails analyzed (when known), discoveries found, potential value. */
export const InvestigationResultsSummary = ({
  emailsAnalyzed,
  discoveriesFound,
  potentialValue,
}: {
  emailsAnalyzed: number | null;
  discoveriesFound: number;
  potentialValue: { currency: string; amount: number }[];
}) => {
  const { t } = useTranslation('investigation');
  const { locale } = useLocale();

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {emailsAnalyzed !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t('results.summary.emailsAnalyzed')}
          </dt>
          <dd className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {formatNumber(emailsAnalyzed, locale)}
          </dd>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t('results.summary.discoveriesFound')}
        </dt>
        <dd className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
          {formatNumber(discoveriesFound, locale)}
        </dd>
      </div>
      {potentialValue.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t('results.summary.potentialValue')}
          </dt>
          {potentialValue.map(({ currency, amount }) => (
            <dd
              key={currency}
              className="mt-2 text-3xl font-bold tabular-nums text-gray-900"
            >
              {formatCurrency(amount, currency, locale)}
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
};

/** The discovery card list + locked card + hand-off CTAs. Exported for the dev states gallery. */
export const InvestigationResultsContent = ({
  discoveries,
  lockedCount,
  onAction,
  onUpgrade,
}: {
  /** Unlocked discoveries, already mapped to the FE-011 domain type. */
  discoveries: Discovery[];
  lockedCount: number;
  onAction: (discovery: Discovery, action: DiscoveryAction) => void;
  onUpgrade: () => void;
}) => {
  const { t } = useTranslation('investigation');

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {discoveries.map((discovery) => (
          <li key={discovery.id}>
            <DiscoveryCard
              discovery={discovery}
              onAction={(action) => onAction(discovery, action)}
            />
          </li>
        ))}
      </ul>

      {lockedCount > 0 && <LockedDiscoveryCard count={lockedCount} onUpgrade={onUpgrade} />}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
        <Link
          to={DISCOVERIES_PATH}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-base font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          {t('results.seeAll')}
        </Link>
        {lockedCount > 0 && (
          <Link
            to={UPGRADE_PATH}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-base font-medium text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            {t('results.unlockCta')}
          </Link>
        )}
      </div>
    </div>
  );
};

const InvestigationResultsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('investigation');
  const investigationId = searchParams.get('investigationId');

  // The completed investigation row feeds "Emails analyzed" — polled through
  // the same hook as the progress page (a completed run never polls; an
  // unfinished one keeps live numbers). Without ?investigationId= the stat
  // is simply omitted rather than faked.
  const investigation = useInvestigation(investigationId);
  const discoveriesQuery = useInvestigationDiscoveries();

  const handleAction = (_discovery: Discovery, _action: DiscoveryAction) => {
    // Discovery actions belong to the full DiscoveriesPage (FE-013) — the
    // onboarding hand-off renders the cards read-only for now.
  };

  const handleUpgrade = () => {
    navigate(UPGRADE_PATH);
  };

  const mapped = useMemo(
    () => (discoveriesQuery.data ? discoveriesQuery.data.discoveries.filter((d) => !d.isLocked).map(toDiscovery) : []),
    [discoveriesQuery.data],
  );

  let content;
  if (discoveriesQuery.isPending) {
    content = (
      <div className="flex-1 flex flex-col items-center justify-center gap-4" aria-live="polite">
        <LoadingSpinner size="lg" />
      </div>
    );
  } else if (discoveriesQuery.isError) {
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <ErrorState onRetry={() => void discoveriesQuery.refetch()} />
      </div>
    );
  } else if (discoveriesQuery.data.total === 0) {
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState
          title={t('results.empty.title')}
          description={t('results.empty.description')}
          action={{ label: t('results.seeAll'), onClick: () => navigate(DISCOVERIES_PATH) }}
        />
      </div>
    );
  } else {
    const data = discoveriesQuery.data;
    content = (
      <InvestigationResultsContent
        discoveries={mapped}
        lockedCount={data.lockedCount}
        onAction={handleAction}
        onUpgrade={handleUpgrade}
      />
    );
  }

  const data = discoveriesQuery.data;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">{t('results.title')}</h1>
        {data && (
          <div className="mt-6">
            <InvestigationResultsSummary
              emailsAnalyzed={
                // A final count exists only when the run actually ended —
                // never show 0 for an unknown number.
                investigation.completedAt !== null ? investigation.emailsReviewed : null
              }
              discoveriesFound={data.total}
              potentialValue={sumPotentialValue(data.discoveries)}
            />
          </div>
        )}
        <div className="mt-8">{content}</div>
      </div>
    </div>
  );
};

export default InvestigationResultsPage;
