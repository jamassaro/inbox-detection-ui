import { useTranslation } from 'react-i18next';
import { ChevronRight, Lock } from 'lucide-react';
import type { Discovery } from '../../src/types';
import { getDiscoveryMeta, getDiscoveryTypeKey } from '../../src/lib/discoveryHelpers';
import { formatCurrency, formatDate, formatRelativeDate } from '../../src/lib/formatting';

interface RecentDiscoveryProps {
  discovery: Discovery;
  locale: string;
  onOpen: (discovery: Discovery) => void;
}

const RecentDiscovery = ({ discovery, locale, onOpen }: RecentDiscoveryProps) => {
  const { t } = useTranslation('discoveries');
  const meta = getDiscoveryMeta(discovery.type);
  const Icon = meta.icon;

  const detail = [
    discovery.amount != null && discovery.currency
      ? formatCurrency(discovery.amount, discovery.currency, locale)
      : null,
    discovery.date ? formatDate(discovery.date, locale) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(discovery)}
        aria-label={t('extension.openDiscovery', { ns: 'common', company: discovery.company })}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white">
          {discovery.companyInitials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            {/* Company is a proper noun — rendered as-is */}
            <span className="truncate text-sm font-semibold text-gray-900">{discovery.company}</span>
            {discovery.createdAt && (
              <time dateTime={discovery.createdAt} className="shrink-0 text-xs text-gray-500">
                {formatRelativeDate(discovery.createdAt, locale)}
              </time>
            )}
          </span>
          <span
            className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${meta.colorClass}`}
          >
            <Icon aria-hidden="true" className="h-3 w-3" />
            {t(getDiscoveryTypeKey(discovery.type), { nsSeparator: '.' })}
          </span>
          {discovery.locked ? (
            <span className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <Lock aria-hidden="true" className="h-3 w-3" />
              {t('card.locked.cta')}
            </span>
          ) : (
            <>
              {/* AI-generated title — rendered as-is, never through t() */}
              <span className="mt-1 block truncate text-sm text-gray-600">{discovery.title}</span>
              {detail && <span className="mt-0.5 block text-xs text-gray-500">{detail}</span>}
            </>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="mt-2 h-4 w-4 shrink-0 text-gray-400" />
      </button>
    </li>
  );
};

export default RecentDiscovery;
