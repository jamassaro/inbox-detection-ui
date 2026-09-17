import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import AgentStatusBadge from '../components/AgentStatusBadge';
import DiscoveryCard from '../components/DiscoveryCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ReminderModal from '../components/ReminderModal';
import RequiresPro from '../components/RequiresPro';
import SkeletonCard from '../components/SkeletonCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../hooks/useAuth';
import { useDashboard } from '../hooks/useDashboard';
import { useGmailStatus } from '../hooks/useGmailStatus';
import { useLocale } from '../hooks/useLocale';
import { useToast } from '../hooks/useToast';
import { getGreetingPeriod } from '../lib/greetingHelpers';
import { formatCurrency, formatNumber } from '../lib/formatting';
import type { Discovery, DiscoveryAction } from '../types';

/**
 * The authenticated home screen (FE-015): the detective's state, the user's
 * potential value, and the highest-priority discoveries at a glance.
 *
 * Data comes from `useDashboard` (one `GET /discoveries?status=active&limit=100`
 * window — the backend has no importance filter, so priority is derived
 * client-side from the wire `priority` field; see the hook's module docs).
 */

const DISCOVERIES_PATH = '/app/discoveries';

const StatCardShell = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5">{children}</div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const toast = useToast();

  const gmailStatus = useGmailStatus();
  const { data, isLoading, isError, refetch, dismiss } = useDashboard();

  const greetingPeriod = getGreetingPeriod(new Date());
  const name = user?.name ?? t('greeting.fallbackName');
  /** Discovery whose ReminderModal (FE-020) is open — both plans land here. */
  const [reminderDiscovery, setReminderDiscovery] = useState<Discovery | null>(null);

  const handleAction = (discovery: Discovery, action: DiscoveryAction) => {
    if (action === 'dismiss') {
      dismiss.mutate(discovery.id, {
        onSuccess: () => toast.success(t('dashboard.toasts.dismissed')),
        onError: () => toast.error(t('dashboard.toasts.dismissFailed')),
      });
      return;
    }
    if (action === 'remind') {
      // FE-020: the real reminder flow for both plans — Free sees the Pro
      // paywall inline in the modal (with the post-upgrade resumption
      // context), Pro creates reminders directly.
      setReminderDiscovery(discovery);
      return;
    }
    // Remaining card actions belong to the full discoveries surface (FE-013).
    toast.info(t('dashboard.toasts.actionComingSoon'));
  };

  let content;
  if (isLoading) {
    content = (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
        </div>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
    </div>
    );
  } else if (isError) {
    content = <ErrorState onRetry={() => void refetch()} />;
  } else if (!data || data.isEmpty) {
    content = (
      <EmptyState
        icon={ShieldCheck}
        title={t('dashboard.empty.title')}
        description={t('dashboard.empty.description')}
      />
    );
  } else {
    const { stats, priorityDiscoveries } = data;
    // No amounts in the window → genuinely zero money found; formatNumber
    // avoids pretending a currency the rows never reported.
    const moneyFound =
      stats.moneyFound.length > 0
        ? stats.moneyFound.map((sum) => formatCurrency(sum.amount, sum.currency, locale)).join(' + ')
        : formatNumber(0, locale);

    content = (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardShell>
            <StatCard value={moneyFound} label={t('dashboard.stats.moneyFound')} color="green" />
          </StatCardShell>
          <StatCardShell>
            <StatCard
              value={formatNumber(stats.subscriptionCount, locale)}
              label={t('dashboard.stats.subscriptions')}
            />
          </StatCardShell>
          <StatCardShell>
            <StatCard
              value={formatNumber(stats.needsAttentionCount, locale)}
              label={t('dashboard.stats.needsAttention')}
              color={stats.needsAttentionCount > 0 ? 'red' : 'default'}
            />
          </StatCardShell>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.priorityTitle')}</h2>
          <div className="mt-4 space-y-4">
            {priorityDiscoveries.map((discovery) => (
              <DiscoveryCard
                key={discovery.id}
                discovery={discovery}
                onAction={(action) => handleAction(discovery, action)}
              />
            ))}
          </div>
          <Link
            to={DISCOVERIES_PATH}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            {t('dashboard.seeAll')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          {t(`greeting.${greetingPeriod}`, { name })}
        </h1>
        {/* No "Not connected" flash while the status check is in flight. */}
        {gmailStatus.data ? (
          <div className="mt-2">
            <AgentStatusBadge
              connected={gmailStatus.data.connected}
              lastSync={gmailStatus.data.lastSync}
              newDiscoveryCount={data ? data.stats.needsAttentionCount : null}
            />
          </div>
        ) : (
          <div className="mt-2 h-4 w-36 animate-pulse rounded bg-gray-200" aria-hidden="true" />
        )}
      </header>

      <div className="mt-6">{content}</div>

      {/* Placeholder Pro briefing (FE-015 out-of-scope note): full Daily
          Briefing content comes in a future ticket; Free users see the
          standard upgrade prompt. */}
      <div className="mt-10">
        <RequiresPro feature="dailyBriefing">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {t('dashboard.briefing.title')}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{t('dashboard.briefing.placeholder')}</p>
          </section>
        </RequiresPro>
      </div>

      {reminderDiscovery !== null && (
        <ReminderModal
          discoveryId={reminderDiscovery.id}
          discoveryTitle={reminderDiscovery.title}
          discoveryDate={reminderDiscovery.date}
          isOpen
          onClose={() => setReminderDiscovery(null)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
