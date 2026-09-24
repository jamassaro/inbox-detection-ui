import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useLocale } from '../hooks/useLocale';
import { formatCurrency, formatDate, formatNumber, formatRelativeDate, isFormattableCurrency } from '../lib/formatting';
import type { ChatArtifact } from '../hooks/useChat';

type CompanyData = Extract<ChatArtifact, { type: 'company' }>['data'];
type OfferData = Extract<ChatArtifact, { type: 'offer' }>['data'];
type OfferHistoryData = Extract<ChatArtifact, { type: 'offer_history' }>['data'];

/**
 * Unit-aware value formatting for an offer-shaped artifact — `unit` is not
 * always a currency (backend: "percent" | "points" | a real ISO code).
 * `isFormattableCurrency` is the same defensive check used for the earlier
 * `currency: "percent"` crash fix (src/lib/discoveryWire.ts) — this is
 * backend-computed data, but still a wire boundary, so an unrecognized unit
 * falls back to a raw "value unit" string instead of crashing.
 */
function formatArtifactValue(value: number, unit: string, locale: string, t: TFunction): string {
  if (unit === 'percent') return t('chat.artifacts.percentOff', { value });
  if (unit === 'points') return t('chat.artifacts.pointsValue', { value: formatNumber(value, locale) });
  if (isFormattableCurrency(unit)) return formatCurrency(value, unit, locale);
  return `${formatNumber(value, locale)} ${unit}`;
}

/** Not a link in v1 — there's no company-detail destination anywhere in the app yet. */
const CompanyCard = ({ data }: { data: CompanyData }) => {
  const { t } = useTranslation('detective');
  const { locale } = useLocale();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3" data-testid="artifact-company">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="text-sm font-semibold text-gray-900">{data.name}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {t('chat.artifacts.offerCount', { count: data.offerCount })}
      </p>
      {data.bestOffer ? (
        <p className="mt-1 text-sm font-medium text-gray-900">
          {t('chat.artifacts.bestOffer', {
            value: formatCurrency(data.bestOffer.value, data.bestOffer.unit, locale),
          })}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-gray-400">
        {t('chat.artifacts.lastSeen', { time: formatRelativeDate(data.lastSeenAt, locale) })}
      </p>
    </div>
  );
};

/** Links to the real discovery behind the offer — a real destination, unlike CompanyCard. */
const OfferCard = ({ data }: { data: OfferData }) => {
  const { t } = useTranslation('detective');
  const { locale } = useLocale();

  return (
    <Link
      to={`/app/discoveries/${data.discoveryId}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
      data-testid="artifact-offer"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{data.company}</span>
        {data.historicalBest ? (
          <span
            data-testid="artifact-historical-best"
            className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
          >
            {t('chat.artifacts.historicalBest')}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold text-gray-900">
        {formatArtifactValue(data.value, data.unit, locale, t)}
      </p>
      {data.expiresAt ? (
        <p className="mt-1 text-xs text-gray-500">
          {t('chat.artifacts.expiresOn', { date: formatDate(data.expiresAt, locale) })}
        </p>
      ) : null}
    </Link>
  );
};

const OfferHistoryCard = ({ data }: { data: OfferHistoryData }) => {
  const { t } = useTranslation('detective');
  const { locale } = useLocale();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3" data-testid="artifact-offer-history">
      <p className="text-sm font-semibold text-gray-900">{data.company}</p>
      <ul className="mt-2 space-y-1.5">
        {data.offers.map((offer) => (
          <li key={offer.discoveryId}>
            <Link
              to={`/app/discoveries/${offer.discoveryId}`}
              className="flex items-center justify-between gap-2 text-xs text-gray-600 hover:text-gray-900 hover:underline"
            >
              <span>{formatDate(offer.date, locale)}</span>
              <span className="font-medium">
                {formatArtifactValue(offer.value, offer.unit, locale, t)}
                {offer.best ? ` · ${t('chat.artifacts.historicalBest')}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Type → component lookup (the spec's own suggested contract). An
 * unrecognized artifact type renders nothing rather than crashing — the
 * backend may ship a new type before the frontend knows about it.
 */
const artifactComponents: Record<ChatArtifact['type'], ComponentType<{ data: never }>> = {
  company: CompanyCard,
  offer: OfferCard,
  offer_history: OfferHistoryCard,
};

/**
 * Renders every artifact attached to an assistant message — usually an
 * empty array (generic questions, meta-questions, or a company with no
 * dollar/percent-valued offers), never more than 2 per message.
 */
const ChatArtifactList = ({ artifacts }: { artifacts: ChatArtifact[] }) => {
  if (artifacts.length === 0) return null;

  return (
    <div className="mt-3 space-y-2" data-testid="chat-artifacts">
      {artifacts.map((artifact, index) => {
        const Component = artifactComponents[artifact.type] as ComponentType<{ data: typeof artifact.data }> | undefined;
        return Component ? <Component key={index} data={artifact.data} /> : null;
      })}
    </div>
  );
};

export default ChatArtifactList;
