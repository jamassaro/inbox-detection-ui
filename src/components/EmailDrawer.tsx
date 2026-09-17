import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Mail, X } from 'lucide-react';
import ActionButton from './ActionButton';
import ErrorState from './ErrorState';
import SkeletonListItem from './SkeletonListItem';
import { useDiscoverySource } from '../hooks/useDiscovery';
import { sanitizeEmailHtml } from '../lib/sanitize';
import { formatDate } from '../lib/formatting';

export interface EmailDrawerProps {
  discoveryId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SKELETON_ROWS = 3;

/**
 * Source-email evidence drawer (FE-014): slides in from the right as a fixed
 * overlay, NOT a modal — the page stays visible behind it.
 *
 * Security (FE-027): the evidence `excerpt` is attacker-controlled content.
 * It passes through `sanitizeEmailHtml` (DOMPurify, restrictive allowlist)
 * before any dangerouslySetInnerHTML — this component must never render raw
 * email HTML.
 *
 * Accessibility: opening moves focus to the close button, Escape closes, and
 * focus returns to the trigger that opened the drawer.
 */
const EmailDrawer = ({ discoveryId, isOpen, onClose }: EmailDrawerProps) => {
  const { t, i18n } = useTranslation('discoveries');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lazy fetch: the query only fires while the drawer is open.
  const { data, isPending, isError, refetch } = useDiscoverySource(discoveryId, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="email-drawer">
      {/* Overlay — click to close; the page remains visible behind it */}
      <div
        aria-hidden="true"
        data-testid="email-drawer-overlay"
        className="fixed inset-0 bg-gray-900/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={t('drawer.title')}
        data-testid="email-drawer-panel"
        className="fixed right-0 top-0 flex h-full w-full max-w-md translate-x-0 flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Mail aria-hidden="true" className="h-5 w-5 text-gray-500" />
            {t('drawer.title')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t('drawer.close')}
            data-testid="email-drawer-close"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {isPending ? (
            <div data-testid="email-drawer-loading" className="px-1 py-2">
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <SkeletonListItem key={i} />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title={t('drawer.error.title')}
              description={t('drawer.error.body')}
              onRetry={() => void refetch()}
            />
          ) : (
            <div className="space-y-4" data-testid="email-drawer-content">
              {data?.explanation ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('drawer.whyNote')}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{data.explanation}</p>
                </div>
              ) : null}

              {data?.emails.map((email) => (
                <article
                  key={email.id}
                  data-testid="evidence-item"
                  className="rounded-lg border border-gray-200 p-3"
                >
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
                <p className="text-sm text-gray-500" data-testid="email-drawer-empty">
                  {t('drawer.empty')}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <footer className="border-t border-gray-200 px-4 py-3">
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            {t('drawer.close')}
          </ActionButton>
        </footer>
      </aside>
    </div>
  );
};

export default EmailDrawer;
