import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import DiscoveryCard from '../../components/DiscoveryCard';
import DiscoveryListItem from '../../components/DiscoveryListItem';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import LockedDiscoveryCard from '../../components/LockedDiscoveryCard';
import Modal from '../../components/Modal';
import SkeletonCard from '../../components/SkeletonCard';
import StatCard from '../../components/StatCard';
import UpgradePrompt from '../../components/UpgradePrompt';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  useDiscoveries,
  useDismissDiscovery,
} from '../../hooks/useDiscoveries';
import {
  filterDiscoveries,
  type DiscoveryFilter,
} from '../../lib/discoveryFilters';
import type { Discovery, DiscoveryAction } from '../../types';

/** Search debounce (FE-013): filter after the user pauses typing. */
const SEARCH_DEBOUNCE_MS = 300;

/** Featured cards shown from the high-priority rows. */
const FEATURED_LIMIT = 3;

/** Skeletons shown while the first list fetch is in flight. */
const LOADING_SKELETONS = 4;

const FILTERS: readonly DiscoveryFilter[] = ['all', 'ending-soon', 'new', 'saved'];

const FILTER_LABEL_KEYS: Record<DiscoveryFilter, string> = {
  all: 'page.filters.all',
  'ending-soon': 'page.filters.endingSoon',
  new: 'page.filters.new',
  saved: 'page.filters.saved',
};

/**
 * The discoveries feed (FE-013): stats from the backend's real response
 * metadata, filter tabs and debounced search, a high-priority featured
 * section, the full list, and the Free-tier locked section.
 *
 * Backend reality (BE-028 — see hooks/useDiscoveries.ts): GET /discoveries
 * has no search/date/pagination-by-page params, so the tabs and search
 * filter the fetched window client-side (lib/discoveryFilters.ts). The
 * initial fetch takes the backend's maximum page (limit=100) to make that
 * window as wide as the API allows. The Saved tab has no backend concept
 * and renders an explicit unavailable state.
 */
const DiscoveriesPage = () => {
  const { t } = useTranslation('discoveries');
  const { isFree } = useEntitlements();
  const toast = useToast();

  const { data, isPending, isError, refetch } = useDiscoveries();
  const dismissDiscovery = useDismissDiscovery();

  const [activeFilter, setActiveFilter] = useState<DiscoveryFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [remindUpgradeOpen, setRemindUpgradeOpen] = useState(false);

  const discoveries = useMemo(() => data?.items ?? [], [data]);
  const visibleDiscoveries = useMemo(
    () => filterDiscoveries(discoveries, activeFilter, search),
    [discoveries, activeFilter, search],
  );

  /**
   * Featured = the backend's own high-priority rows (priority urgent/high
   * mapped to importance 'high'), unlocked only — locked rows are masked
   * and must never be featured. Derived from real data, not a synthetic
   * score (the ticket's importance scoring does not exist server-side).
   */
  const featured = useMemo(
    () =>
      discoveries
        .filter((d) => d.importance === 'high' && !d.locked)
        .slice(0, FEATURED_LIMIT),
    [discoveries],
  );

  const lockedCount = data?.lockedCount ?? 0;
  const totalCount = data?.total ?? 0;
  const showFeatured =
    activeFilter === 'all' &&
    search.trim() === '' &&
    featured.length > 0;

  const handleAction = (discovery: Discovery) => (action: DiscoveryAction) => {
    switch (action) {
      case 'dismiss':
        dismissDiscovery.mutate(discovery.id);
        break;
      case 'remind':
        // ReminderModal is FE-020 and is not built yet. Free users get the
        // RequiresPro upgrade path; Pro users get the honest not-yet state.
        if (isFree) {
          setRemindUpgradeOpen(true);
        } else {
          toast.info(t('page.remindUnavailable.body'));
          // TODO(FE-020): open ReminderModal once it exists.
        }
        break;
      case 'view_source':
        // EmailDrawer is FE-014 and is not built yet — no clickable no-op.
        toast.info(t('page.sourceUnavailable.body'));
        // TODO(FE-014): open EmailDrawer with the discovery's evidence.
        break;
      default:
        // Remaining actions (open_provider, investigate, …) route through
        // their own tickets; surfacing them as clickable no-ops would lie.
        break;
    }
  };

  if (isPending) {
    return (
      <div className="p-6 lg:p-8" data-testid="discoveries-page-loading">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: LOADING_SKELETONS - 1 }, (_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {Array.from({ length: LOADING_SKELETONS }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 lg:p-8" data-testid="discoveries-page-error">
        <ErrorState
          title={t('page.error.title')}
          description={t('page.error.body')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8" data-testid="discoveries-page">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('page.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('page.subtitle')}</p>
      </header>

      {/* Stats — all three values come from the backend's real response metadata */}
      <div className="grid grid-cols-3 gap-4" data-testid="discoveries-stats">
        <StatCard value={totalCount} label={t('page.stats.total')} />
        <StatCard value={discoveries.length} label={t('page.stats.active')} color="green" />
        <StatCard value={lockedCount} label={t('page.stats.locked')} color="red" />
      </div>

      {/* Search + filter tabs */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t('page.searchPlaceholder')}
          aria-label={t('page.searchPlaceholder')}
          data-testid="discoveries-search"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <div
          className="flex gap-1 rounded-lg bg-gray-100 p-1"
          role="tablist"
          aria-label={t('page.filters.all')}
          data-testid="discoveries-filter-tabs"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              data-testid={`filter-tab-${filter}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t(FILTER_LABEL_KEYS[filter])}
            </button>
          ))}
        </div>
      </div>

      {/* Featured — backend high-priority rows, All tab, no active search */}
      {showFeatured ? (
        <section className="mt-8" data-testid="featured-section">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('page.featuredTitle')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((discovery) => (
              <DiscoveryCard
                key={discovery.id}
                discovery={discovery}
                onAction={handleAction(discovery)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Free-tier locked section — backend-reported lockedCount, no client plan math */}
      {lockedCount > 0 ? (
        <section className="mt-8" data-testid="locked-section">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('page.lockedSection.title')}
          </h2>
          <LockedDiscoveryCard
            count={lockedCount}
            onUpgrade={() => window.location.assign('/upgrade')}
          />
        </section>
      ) : null}

      {/* Full list */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('page.listTitle')}
        </h2>
        {activeFilter === 'saved' ? (
          <EmptyState
            title={t('page.savedUnavailable.title')}
            description={t('page.savedUnavailable.body')}
          />
        ) : visibleDiscoveries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t('page.empty.title')}
            description={t('page.empty.body')}
          />
        ) : (
          <div
            className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white"
            data-testid="discoveries-list"
          >
            {visibleDiscoveries.map((discovery) => (
              <DiscoveryListItem
                key={discovery.id}
                discovery={discovery}
                onAction={handleAction(discovery)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Remind-me paywall (FE-020 not built): RequiresPro upgrade path */}
      <Modal
        isOpen={remindUpgradeOpen}
        onClose={() => setRemindUpgradeOpen(false)}
        title={t('page.remindUnavailable.title')}
      >
        <UpgradePrompt feature="reminders" />
      </Modal>
    </div>
  );
};

export default DiscoveriesPage;
