import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ThumbsDown, ThumbsUp } from 'lucide-react';
import ActionButton from '../../components/ActionButton';
import ConfirmModal from '../../components/ConfirmModal';
import EmailDrawer from '../../components/EmailDrawer';
import ErrorState from '../../components/ErrorState';
import Modal from '../../components/Modal';
import ReminderModal from '../../components/ReminderModal';
import SkeletonCard from '../../components/SkeletonCard';
import UpgradePrompt from '../../components/UpgradePrompt';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useToast } from '../../hooks/useToast';
import { useDiscoveryFeedback, useDismissDiscovery } from '../../hooks/useDiscoveries';
import { useDiscovery } from '../../hooks/useDiscovery';
import {
  getDiscoveryActionKey,
  getDiscoveryMeta,
  getDiscoveryTypeKey,
  getFrequencyLabelKey,
} from '../../lib/discoveryHelpers';
import { formatCurrency, formatDate } from '../../lib/formatting';
import { ApiError } from '../../lib/apiError';
import type { Discovery, DiscoveryAction } from '../../types';

/** Importance badge treatment — mirrors DiscoveryListItem (FE-012). */
const IMPORTANCE_BADGE: Record<Discovery['importance'], string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
};

/** Annualization multipliers for recurring amounts (one-time never annualizes). */
const ANNUAL_MULTIPLIER: Record<Exclude<NonNullable<Discovery['frequency']>, 'one_time'>, number> = {
  weekly: 52,
  monthly: 12,
  annual: 1,
};

/** Back navigation chrome shared by every detail state. */
const BackButton = ({ label, onBack }: { label: string; onBack: () => void }) => (
  <button
    type="button"
    onClick={onBack}
    data-testid="detail-back"
    className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
  >
    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
    {label}
  </button>
);

/** True when the 402 "locked" answer is what the query failed with. */
function isLockedError(error: Error | null): boolean {
  return error instanceof ApiError && error.status === 402;
}

/** Per-year cost derived from a recurring amount — a display value, not data. */
function annualizedCost(amount: number, frequency: NonNullable<Discovery['frequency']>): number | null {
  if (frequency === 'one_time') return null;
  return amount * ANNUAL_MULTIPLIER[frequency];
}

/**
 * Discovery detail (FE-014) at /app/discoveries/:id.
 *
 * Backend reality (BE-028/BE-029 — see hooks/useDiscovery.ts): the detail
 * route returns the raw Prisma row mapped through the shared toDiscovery
 * adapter, evidence lives at GET /:id/evidence (fetched by the EmailDrawer
 * on open), and dismiss/feedback reuse the FE-013 mutations. `previousAmount`
 * does not exist on the wire — the Was/Now diff only renders when a value is
 * actually present; nothing is fabricated. Locked rows answer 402 and render
 * the paywall state instead of any narrative content.
 */
const DiscoveryDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation('discoveries');
  const { isFree } = useEntitlements();
  const toast = useToast();

  const { data: discovery, isPending, isError, error, refetch } = useDiscovery(id);
  const dismissDiscovery = useDismissDiscovery();
  const feedback = useDiscoveryFeedback();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<'calendarActions' | null>(null);

  // FE-020 post-upgrade resumption: `/app/discoveries/:id?openReminder=true`
  // auto-opens the ReminderModal. State is lazily seeded from the param on
  // mount — no setState inside the effect (cascading-render lint); the
  // effect only consumes the param so a refresh or back-navigation does not
  // reopen the modal.
  const [reminderOpen, setReminderOpen] = useState(
    searchParams.get('openReminder') === 'true',
  );

  useEffect(() => {
    if (searchParams.get('openReminder') !== 'true') return;
    const next = new URLSearchParams(searchParams);
    next.delete('openReminder');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openPaywallOrToast = (feature: 'calendarActions', unavailableBody: string) => {
    // FE-013 parity: Free users get the RequiresPro upgrade path; Pro users
    // get the honest not-yet state (ReminderModal shipped in FE-020; the
    // calendar picker is FE-021).
    if (isFree) {
      setPaywallFeature(feature);
    } else {
      toast.info(unavailableBody);
    }
  };

  const handleAction = (action: DiscoveryAction) => {
    switch (action) {
      case 'dismiss':
        setConfirmDismissOpen(true);
        break;
      case 'view_source':
        setDrawerOpen(true);
        break;
      case 'remind':
        // FE-020: the ReminderModal owns both plans — Free sees the inline
        // upgrade prompt inside the dialog, Pro gets the real flow.
        setReminderOpen(true);
        break;
      case 'find_time':
        openPaywallOrToast('calendarActions', t('detail.findTimeUnavailable.body'));
        break;
      case 'ask_detective':
        navigate(`/app/chat?discoveryId=${discovery?.id ?? id}`);
        break;
      default:
        // open_provider has no backend URL to link to (BE-029 sends none), and
        // review_subscription/investigate/track_refund route through their own
        // tickets — surfacing them as clickable no-ops would lie.
        toast.info(t('detail.actionUnavailable.body'));
        break;
    }
  };

  const confirmDismiss = () => {
    dismissDiscovery.mutate(id, { onSuccess: () => navigate('/app/discoveries') });
  };

  if (isPending) {
    return (
      <div className="p-6 lg:p-8" data-testid="discovery-detail-loading">
        <div className="mx-auto max-w-2xl space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (isLockedError(error)) {
    return (
      <div className="p-6 lg:p-8" data-testid="discovery-detail-locked">
        <BackButton label={t('detail.back')} onBack={() => navigate('/app/discoveries')} />
        <div className="mx-auto mt-8 max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <CalendarClock aria-hidden="true" className="mx-auto h-10 w-10 text-gray-400" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">{t('detail.locked.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('detail.locked.body')}</p>
          <ActionButton className="mt-6" onClick={() => window.location.assign('/upgrade')}>
            {t('detail.locked.cta')}
          </ActionButton>
        </div>
      </div>
    );
  }

  if (isError || !discovery) {
    return (
      <div className="p-6 lg:p-8" data-testid="discovery-detail-error">
        <BackButton label={t('detail.back')} onBack={() => navigate('/app/discoveries')} />
        <div className="mx-auto mt-8 max-w-md">
          <ErrorState
            title={t('detail.error.title')}
            description={t('detail.error.body')}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  const meta = getDiscoveryMeta(discovery.type);
  const TypeIcon = meta.icon;
  const locale = i18n.language;
  const currency = discovery.currency ?? 'USD';
  const hasPriceChange = discovery.amount != null && discovery.previousAmount != null;
  const frequencyKey = discovery.frequency ? getFrequencyLabelKey(discovery.frequency) : null;
  const annual = discovery.amount != null && discovery.frequency
    ? annualizedCost(discovery.amount, discovery.frequency)
    : null;
  const isDismissed = discovery.status === 'dismissed';

  return (
    <div className="p-6 lg:p-8" data-testid="discovery-detail-page">
      <BackButton label={t('detail.back')} onBack={() => navigate('/app/discoveries')} />

      <div className="mx-auto mt-6 max-w-2xl">
        {/* Header: type icon, company, type badge, importance indicator */}
        <header className="flex items-start gap-4" data-testid="detail-header">
          <div
            className={`${meta.colorClass} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}
            data-testid="detail-type-icon"
          >
            <TypeIcon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500" data-testid="detail-company">
              {discovery.company}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.colorClass}`}
                data-testid="detail-type-badge"
              >
                {/* FE-011 helper keys embed the namespace name
                    ('discoveries.types.x') — resolve them by parsing that
                    prefix as the namespace (mirrors DiscoveryCard). */}
                {t(getDiscoveryTypeKey(discovery.type), { nsSeparator: '.' })}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${IMPORTANCE_BADGE[discovery.importance]}`}
                data-testid="detail-importance"
              >
                {t(`card.importance.${discovery.importance}`)}
              </span>
            </div>
            {/* AI-generated title — render as-is, never through t() */}
            <h1 className="mt-3 text-xl font-semibold text-gray-900" data-testid="detail-title">
              {discovery.title}
            </h1>
          </div>
        </header>

        {/* Amount block — only fields the backend actually sent */}
        {discovery.amount != null ? (
          <section
            className="mt-6 rounded-xl border border-gray-200 bg-white p-5"
            data-testid="detail-amount-block"
          >
            {hasPriceChange ? (
              <div className="flex items-baseline gap-3">
                <span
                  className="text-sm text-gray-500 line-through"
                  data-testid="detail-previous-amount"
                >
                  {t('card.was')} {formatCurrency(discovery.previousAmount!, currency, locale)}
                </span>
                <span className="text-2xl font-semibold text-gray-900" data-testid="detail-amount">
                  {formatCurrency(discovery.amount, currency, locale)}
                </span>
              </div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900" data-testid="detail-amount">
                {formatCurrency(discovery.amount, currency, locale)}
                {frequencyKey ? (
                  <span className="ml-1 text-sm font-normal text-gray-500">
                    /{t(frequencyKey)}
                  </span>
                ) : null}
              </p>
            )}
            {annual != null && !hasPriceChange ? (
              <p className="mt-1 text-xs text-gray-500" data-testid="detail-annualized">
                {t('detail.annualized', { amount: formatCurrency(annual, currency, locale) })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Date block — the underlying event date, when known */}
        {discovery.date ? (
          <section
            className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700"
            data-testid="detail-date-block"
          >
            <CalendarClock aria-hidden="true" className="h-5 w-5 text-gray-400" />
            <span>{formatDate(discovery.date, locale)}</span>
          </section>
        ) : null}

        {/* Why flagged — AI-generated summary, render as-is */}
        <section
          className="mt-4 rounded-xl border border-gray-200 bg-white p-5"
          data-testid="detail-summary-block"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('detail.whyTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700" data-testid="detail-summary">
            {discovery.summary}
          </p>
        </section>

        {/* Source evidence — opens the drawer (lazy fetch inside) */}
        <section className="mt-4" data-testid="detail-source-section">
          <ActionButton
            variant="secondary"
            onClick={() => setDrawerOpen(true)}
            data-testid="view-source-button"
          >
            {t('detail.viewSource')}
          </ActionButton>
        </section>

        {/* Actions — every backend-provided action, handlers per ticket */}
        {discovery.availableActions.length > 0 ? (
          <section className="mt-6" data-testid="detail-actions">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t('detail.actionsTitle')}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {discovery.availableActions.map((action) => (
                <ActionButton
                  key={action}
                  variant={action === 'dismiss' ? 'destructive' : 'secondary'}
                  onClick={() => handleAction(action)}
                  data-testid={`detail-action-${action}`}
                >
                  {t(getDiscoveryActionKey(action))}
                </ActionButton>
              ))}
            </div>
          </section>
        ) : null}

        {/* Feedback — thumbs up/down + never-this-type */}
        {isDismissed ? null : feedback.isSuccess ? (
          <p className="mt-8 text-sm text-gray-500" data-testid="detail-feedback-thanks">
            {t('detail.feedback.thanks')}
          </p>
        ) : (
          <section className="mt-8 border-t border-gray-100 pt-6" data-testid="detail-feedback">
            <h2 className="text-sm font-semibold text-gray-900">{t('detail.feedback.title')}</h2>
            <div className="mt-3 flex items-center gap-2">
              <ActionButton
                variant="ghost"
                size="sm"
                isLoading={feedback.isPending}
                onClick={() => feedback.mutate({ id, feedback: 'useful' })}
                data-testid="feedback-useful"
              >
                <ThumbsUp aria-hidden="true" className="h-4 w-4" />
                {t('detail.feedback.useful')}
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="sm"
                isLoading={feedback.isPending}
                onClick={() => feedback.mutate({ id, feedback: 'not_useful' })}
                data-testid="feedback-not-useful"
              >
                <ThumbsDown aria-hidden="true" className="h-4 w-4" />
                {t('detail.feedback.notUseful')}
              </ActionButton>
              <button
                type="button"
                onClick={() => feedback.mutate({ id, feedback: 'never_this_type' })}
                data-testid="feedback-never"
                className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
              >
                {t('detail.feedback.neverThisType')}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Dismiss confirmation — API fires only on confirm */}
      <ConfirmModal
        isOpen={confirmDismissOpen}
        title={t('detail.dismissConfirm.title')}
        message={t('detail.dismissConfirm.body')}
        variant="destructive"
        onConfirm={() => {
          setConfirmDismissOpen(false);
          confirmDismiss();
        }}
        onCancel={() => setConfirmDismissOpen(false)}
      />

      {/* Reminders (FE-020) — both plans; Free sees the inline upgrade prompt */}
      <ReminderModal
        discoveryId={id}
        discoveryDate={discovery.date}
        discoveryTitle={discovery.title}
        isOpen={reminderOpen}
        onClose={() => setReminderOpen(false)}
      />

      {/* Pro-gated action without a shipped flow (FE-021 calendar) — RequiresPro upgrade path */}
      <Modal
        isOpen={paywallFeature !== null}
        onClose={() => setPaywallFeature(null)}
        title={t('detail.paywall.title')}
      >
        {paywallFeature ? <UpgradePrompt feature={paywallFeature} /> : null}
      </Modal>

      {/* Evidence drawer — slide-in from the right, fetches on open */}
      <EmailDrawer
        discoveryId={id}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default DiscoveryDetailPage;
