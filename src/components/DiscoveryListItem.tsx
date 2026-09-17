import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getDiscoveryActionKey, getDiscoveryMeta } from '../lib/discoveryHelpers';
import { formatCurrency, formatDate } from '../lib/formatting';
import type { Discovery, DiscoveryAction } from '../types';

interface DiscoveryListItemProps {
  discovery: Discovery;
  onAction: (action: DiscoveryAction) => void;
}

/** Importance badge treatment — static Tailwind strings for the scanner. */
const IMPORTANCE_BADGE: Record<Discovery['importance'], string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
};

/**
 * Compact list representation of a Discovery (FE-012): left type icon,
 * center identity + metadata, right amount/date. Clicking anywhere navigates
 * to the discovery detail route; the primary action button stops propagation
 * so acting on a row never navigates.
 */
const DiscoveryListItem = ({ discovery, onAction }: DiscoveryListItemProps) => {
  const { t, i18n } = useTranslation('discoveries');
  const navigate = useNavigate();
  const meta = getDiscoveryMeta(discovery.type);
  const { amount, currency = 'USD', frequency, date } = discovery;
  const Icon = meta.icon;
  const [primaryAction] = discovery.availableActions;

  return (
    <div
      data-testid="discovery-list-item"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/app/discoveries/${discovery.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          navigate(`/app/discoveries/${discovery.id}`);
        }
      }}
      className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      {/* Left: type icon + company initials avatar */}
      <div
        className={`${meta.colorClass} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}
        data-testid="type-icon"
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div
        className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold shrink-0"
        data-testid="list-item-avatar"
      >
        {discovery.companyInitials}
      </div>

      {/* Center: company, AI title (as-is), amount + date metadata */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{discovery.company}</div>
        <div className="text-sm text-gray-600 truncate">{discovery.title}</div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2" data-testid="list-item-meta">
          {amount != null && <span>{formatCurrency(amount, currency, i18n.language)}{frequency ? ` / ${t(`card.frequency.${frequency}`, { defaultValue: '' })}` : ''}</span>}
          {date && <span>{formatDate(date, i18n.language)}</span>}
        </div>
      </div>

      {/* Right: importance badge + primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`text-xs font-medium ${IMPORTANCE_BADGE[discovery.importance]}`}
          data-testid="importance-indicator"
        >
          {t(`card.importance.${discovery.importance}`)}
        </span>
        {primaryAction != null && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAction(primaryAction);
            }}
            className="bg-gray-900 text-white py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
            data-testid="list-item-primary-action"
          >
            {t(getDiscoveryActionKey(primaryAction), { nsSeparator: '.' })}
          </button>
        )}
      </div>
    </div>
  );
};

export default DiscoveryListItem;
