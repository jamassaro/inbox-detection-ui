import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import ErrorState from './ErrorState';
import SkeletonListItem from './SkeletonListItem';
import { sanitizeEmailHtml } from '../lib/sanitize';
import { formatDate } from '../lib/formatting';
import type { DiscoveryEvidence } from '../hooks/useDiscovery';

export interface EmailEvidenceListProps {
  data: DiscoveryEvidence | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

const SKELETON_ROWS = 3;

/**
 * Source-email evidence (FE-014): loading skeleton, error+retry, or the
 * per-email cards — pure content, no drawer/modal/page chrome, so callers
 * can place it inline (DiscoveryDetailPage) or inside an overlay.
 *
 * Security (FE-027): `excerpt` is attacker-controlled content. It passes
 * through `sanitizeEmailHtml` (DOMPurify, restrictive allowlist) before any
 * `dangerouslySetInnerHTML` — this component must never render raw email HTML.
 */
const EmailEvidenceList = ({ data, isPending, isError, onRetry }: EmailEvidenceListProps) => {
  const { t, i18n } = useTranslation('discoveries');

  if (isPending) {
    return (
      <div data-testid="evidence-loading" className="px-1 py-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('drawer.error.title')} description={t('drawer.error.body')} onRetry={onRetry} />
    );
  }

  return (
    <div className="space-y-4" data-testid="evidence-content">
      {data?.explanation ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('drawer.whyNote')}</p>
          <p className="mt-1 text-sm text-gray-700">{data.explanation}</p>
        </div>
      ) : null}

      {data?.emails.map((email) => (
        <article key={email.id} data-testid="evidence-item" className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500" data-testid="evidence-sender">
            {t('drawer.from')} <span className="font-medium text-gray-700">{email.sender}</span>
          </p>
          <h3 className="mt-1 text-sm font-semibold text-gray-900" data-testid="evidence-subject">
            {email.subject}
          </h3>
          <p className="text-xs text-gray-500" data-testid="evidence-date">
            {formatDate(email.date, i18n.language)}
          </p>
          {/* Sanitized (FE-027) — the excerpt may carry markup from the original email. */}
          <div
            className="prose prose-sm mt-2 max-w-none text-sm text-gray-600"
            data-testid="evidence-excerpt"
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.excerpt) }}
          />
          <a
            href={email.gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="evidence-gmail-link"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
          >
            {t('drawer.openInGmail')}
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </article>
      ))}

      {data !== undefined && data.emails.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="evidence-empty">
          {t('drawer.empty')}
        </p>
      ) : null}
    </div>
  );
};

export default EmailEvidenceList;
