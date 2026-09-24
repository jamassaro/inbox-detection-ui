import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ExternalLink } from 'lucide-react';
import {
  getDiscoveryActionKey,
  getDiscoveryMeta,
  getDiscoveryTypeKey,
  getFrequencyLabelKey,
} from '../lib/discoveryHelpers';
import { formatCurrency, formatDate } from '../lib/formatting';
import type { Discovery, DiscoveryAction, DiscoveryImportance } from '../types';

interface DiscoveryCardProps {
  discovery: Discovery;
  onAction: (action: DiscoveryAction) => void;
  compact?: boolean;
}

/** Maximum visible actions: 1 primary + 2 secondary (FE-012). */
const MAX_VISIBLE_ACTIONS = 3;

/** Importance label treatment — static Tailwind strings for the scanner. */
const IMPORTANCE_TEXT: Record<DiscoveryImportance, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
};

const IMPORTANCE_DOT: Record<DiscoveryImportance, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

/**
 * Small co-located sub-component: colored dot + translated importance label.
 * Used by both rows in this card; DiscoveryListItem keeps its own copy.
 */
const ImportanceIndicator = ({ importance }: { importance: DiscoveryImportance }) => {
  const { t } = useTranslation('discoveries');
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${IMPORTANCE_TEXT[importance]}`}
      data-testid="importance-indicator"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${IMPORTANCE_DOT[importance]}`} aria-hidden="true" />
      {t(`card.importance.${importance}`)}
    </span>
  );
};

/**
 * The primary visual representation of a Discovery (FE-012). ONE component
 * renders all 12 DiscoveryTypes via conditional rows — never per-type cards.
 * Visual design language inherited from FeaturedOfferCard: white background,
 * rounded-xl, border border-gray-200, gray-900 primary button, green badge
 * for positive amounts.
 */
const DiscoveryCard = ({ discovery, onAction, compact = false }: DiscoveryCardProps) => {
  const { t, i18n } = useTranslation('discoveries');
  const navigate = useNavigate();
  const locale = i18n.language;
  const meta = getDiscoveryMeta(discovery.type);
  const { amount, previousAmount, currency = 'USD', frequency, date } = discovery;

  const frequencyKey = frequency != null ? getFrequencyLabelKey(frequency) : null;
  // getFrequencyLabelKey returns colon-form keys (ns embedded via ':') which
  // resolve with the app's default separator — no options needed.
  const frequencySuffix = frequencyKey ? t(frequencyKey) : '';

  // Actions come from the backend via availableActions; labels map through
  // getDiscoveryActionKey so raw enum values never reach the UI. Two are
  // excluded from these primary/secondary slots: open_provider gets its own
  // CTA row below (real external links, not a single onAction click), and
  // view_evidence would just navigate to the same place the always-present
  // View button already goes — a near-duplicate button competing for a
  // scarce slot. Dedupe so a duplicated action in the wire payload cannot
  // produce duplicate React keys in the secondary-action row (primary keeps
  // its first occurrence).
  const clickableActions = discovery.availableActions.filter(
    (action) => action !== 'open_provider' && action !== 'view_evidence',
  );
  const [primaryAction, ...secondaryActionsRaw] = clickableActions.slice(0, MAX_VISIBLE_ACTIONS);
  const secondaryActions = [...new Set(secondaryActionsRaw)];

  const priceChange =
    amount != null && previousAmount != null
      ? { previousAmount, amount, diff: amount - previousAmount }
      : null;

  return (
    <div
      data-testid="discovery-card"
      className={`bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow ${
        compact ? 'p-3' : 'p-5'
      }`}
    >
      {/* Top row: company avatar + name, type badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`${
              compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
            } bg-gray-900 text-white rounded-lg flex items-center justify-center font-semibold shrink-0`}
          >
            {discovery.companyInitials}
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{discovery.company}</h3>
        </div>
        <span
          className={`${meta.colorClass} text-xs font-semibold px-2.5 py-1 rounded-md shrink-0`}
          data-testid="type-badge"
        >
          {/* FE-011 helper keys embed the namespace name ('discoveries.types.x')
              — resolve them by parsing that prefix as the namespace. */}
          {t(getDiscoveryTypeKey(discovery.type), { nsSeparator: '.' })}
        </span>
      </div>

      {/* AI-generated title — rendered as-is, never through t() */}
      <p className={`text-sm text-gray-600 ${compact ? 'mb-3' : 'mb-4'}`}>{discovery.title}</p>

      {(amount != null || date) && (
        <div className={compact ? 'space-y-1.5 mb-3' : 'space-y-2 mb-4'}>
          {/* Amount row: formatCurrency + frequency label */}
          {amount != null && (
            <div className="flex items-center gap-2" data-testid="amount-row">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  amount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}
                data-testid="amount-badge"
              >
                {formatCurrency(amount, currency, locale)}
              </span>
              {frequencySuffix && <span className="text-sm text-gray-500">{frequencySuffix}</span>}
            </div>
          )}

          {/* Date row: formatDate + importance indicator */}
          {date && (
            <div className="flex items-center gap-2 text-sm text-gray-500" data-testid="date-row">
              <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{formatDate(date, locale)}</span>
              <ImportanceIndicator importance={discovery.importance} />
            </div>
          )}

          {/* Price change row: previous → current, color-coded diff
              (red for an increase, green for savings) */}
          {priceChange && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600" data-testid="price-change-row">
              <span>
                {t('card.was')}{' '}
                <span className="line-through">{formatCurrency(priceChange.previousAmount, currency, locale)}</span>
              </span>
              <span aria-hidden="true">→</span>
              <span className="font-medium text-gray-900">
                {t('card.now')} {formatCurrency(priceChange.amount, currency, locale)}
              </span>
              {priceChange.diff !== 0 && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    priceChange.diff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}
                  data-testid="price-diff"
                >
                  {priceChange.diff > 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(priceChange.diff), currency, locale)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Call-to-action links — real merchant links from the source email
          (never AI-invented), own row: multiple external links don't fit
          the single primary + 2 secondary onAction slots below. */}
      {discovery.callToActions && discovery.callToActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" data-testid="cta-row">
          {discovery.callToActions.map((cta) => (
            <a
              key={cta.url}
              href={cta.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="cta-link"
              className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-200"
            >
              {cta.label}
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}

      {/* Actions row: View button always present, then max 1 primary + 2 secondary from availableActions */}
      <div className="flex items-center justify-end gap-2" data-testid="actions-row">
        <button
          type="button"
          onClick={() => navigate(`/app/discoveries/${discovery.id}`)}
          className="border border-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          data-testid="card-view-action"
        >
          {t('actions.view')}
        </button>
        {primaryAction != null && (
          <button
            type="button"
            onClick={() => onAction(primaryAction)}
            className="bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            data-testid="card-primary-action"
          >
            {t(getDiscoveryActionKey(primaryAction), { nsSeparator: '.' })}
          </button>
        )}
        {secondaryActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="border border-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            data-testid={`card-secondary-action-${action}`}
          >
            {t(getDiscoveryActionKey(action), { nsSeparator: '.' })}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DiscoveryCard;
