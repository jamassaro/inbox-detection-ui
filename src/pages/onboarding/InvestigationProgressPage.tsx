import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ActionButton from '../../components/ActionButton';
import ErrorState from '../../components/ErrorState';
import { useLocale } from '../../hooks/useLocale';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import {
  INVESTIGATION_TIMEOUT_MS,
  useInvestigation,
  useTriggerInvestigation,
} from '../../hooks/useInvestigation';
import type {
  InvestigationCategory,
  InvestigationProgress,
  InvestigationStatus,
} from '../../hooks/useInvestigation';
import { formatNumber } from '../../lib/formatting';

/**
 * Investigation progress step of onboarding (FE-009) — the product's most
 * important moment. On arrival the page auto-triggers `POST /investigation`
 * (unless one is already active via `?investigationId=`), then polls
 * `GET /investigation/:id` every 3 s through useInvestigation and renders
 * the REAL counters as they arrive. No fabricated progress: categories the
 * backend does not count show a live "checking" pulse while polling and
 * rest quiet when it ends — never invented numbers.
 *
 * All seven FE-009 states are handled:
 *  - `not_started`/`starting`/`running` → live progress view
 *  - `complete` → navigate to `/onboarding/results`
 *  - `failed` (backend failure, or a poll that never returned data) → ErrorState with retry
 *  - `partial` → partial message + continue to results
 *  - `retry` (this page's own state) → the trigger POST failed, or the run
 *    exceeded the 5-minute timeout (FE-009 forbids an infinite spinner)
 */

const RESULTS_PATH = '/onboarding/results';

/**
 * Statuses where the run is still in flight. Drives the category-chip
 * pulse and arms the 5-minute timeout clock.
 */
const isActiveStatus = (status: InvestigationStatus): boolean =>
  status === 'starting' || status === 'running';

/** The categories FE-009 displays, in display order. */
const CATEGORY_ORDER: InvestigationCategory[] = [
  'subscriptions',
  'priceChanges',
  'credits',
  'meetings',
  'expirations',
];

/** Live progress view: header, animated emails-reviewed count, category chips, status label. */
export const InvestigationProgressContent = ({
  emailsReviewed,
  categoriesSeen,
  statusLabel,
  isActive,
}: {
  emailsReviewed: number;
  categoriesSeen: InvestigationProgress['categoriesSeen'];
  /** Pre-translated status label (t('status.*')). */
  statusLabel: string;
  isActive: boolean;
}) => {
  const { t } = useTranslation('investigation');
  const { locale } = useLocale();
  const animated = useAnimatedNumber(emailsReviewed);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center"
        aria-live="polite"
      >
        <h1 className="text-2xl font-bold text-gray-900">{t('progress.header')}</h1>
        <p className="mt-2 text-sm text-gray-500">{statusLabel}</p>

        <p className="mt-8 text-5xl font-bold tabular-nums text-gray-900">
          {formatNumber(animated, locale)}
        </p>
        <p className="mt-1 text-sm text-gray-500">{t('progress.emailsReviewed')}</p>

        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t('progress.categoriesTitle')}
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {CATEGORY_ORDER.map((category) => {
            const count = categoriesSeen[category];
            return (
              <li
                key={category}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  count != null && count > 0
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600'
                }`}
              >
                {t(`progress.categories.${category}`)}
                {count != null && count > 0 ? (
                  // Real per-run count from the Investigation row — the only
                  // category counter the backend provides is subscriptions.
                  <span className="font-semibold tabular-nums">
                    {formatNumber(count, locale)}
                  </span>
                ) : isActive ? (
                  // Still looking — a pulse, never a made-up count.
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/** Partial state: the run ended early, but real discoveries exist — continue to results. */
export const InvestigationPartialState = ({ onContinue }: { onContinue: () => void }) => {
  const { t } = useTranslation('investigation');
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div
        role="alert"
        className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center"
      >
        <p className="text-base font-semibold text-amber-900">{t('status.partial')}</p>
        <p className="mt-1 max-w-sm text-sm text-amber-700">{t('progress.partialMessage')}</p>
        <ActionButton size="sm" className="mt-5" onClick={onContinue}>
          {t('progress.continue')}
        </ActionButton>
      </div>
    </div>
  );
};

const InvestigationProgressPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('investigation');

  // The investigation id arrives either from the URL (reload, post-OAuth
  // return) or from the trigger POST below — either way polling uses it.
  const investigationId = searchParams.get('investigationId');
  const progress = useInvestigation(investigationId);
  const { mutate: triggerInvestigation, isPending: isTriggering, isError: triggerFailed } =
    useTriggerInvestigation();

  // Double-POST guard: StrictMode double-invokes effects, and a re-render
  // must never start a second investigation. The backend is idempotent for
  // active runs, but a failed/finished run WOULD start a new one — so the
  // guard lives here too (FE-009 trust rule).
  const triggeredRef = useRef(false);
  useEffect(() => {
    if (investigationId !== null || triggeredRef.current || isTriggering) return;
    triggeredRef.current = true;
    triggerInvestigation(undefined, {
      onSuccess: ({ id }) => {
        setSearchParams({ investigationId: id }, { replace: true });
      },
    });
  }, [investigationId, isTriggering, triggerInvestigation, setSearchParams]);

  // 5-minute timeout clock: armed while the run is in flight, cleared the
  // moment it ends. The timeout surfaces a message but keeps polling — a
  // late completion still advances (no infinite spinner either way).
  const [timedOut, setTimedOut] = useState(false);
  const active = isActiveStatus(progress.status);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setTimedOut(true), INVESTIGATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (progress.status === 'complete' && investigationId !== null) {
      navigate(`${RESULTS_PATH}?investigationId=${encodeURIComponent(investigationId)}`, {
        replace: true,
      });
    }
  }, [progress.status, investigationId, navigate]);

  const handleRetry = () => {
    setTimedOut(false);
    triggeredRef.current = true;
    triggerInvestigation(undefined, {
      onSuccess: ({ id }) => {
        setSearchParams({ investigationId: id }, { replace: true });
      },
    });
  };

  const handleContinue = () => {
    navigate(
      investigationId !== null
        ? `${RESULTS_PATH}?investigationId=${encodeURIComponent(investigationId)}`
        : RESULTS_PATH,
    );
  };

  let content;
  if (investigationId !== null && progress.status === 'failed') {
    // Backend-reported failure, a 404, or a poll that never returned data —
    // all recover by starting a fresh investigation.
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <ErrorState
          title={t('status.failed')}
          description={progress.error ?? undefined}
          onRetry={handleRetry}
        />
      </div>
    );
  } else if (triggerFailed) {
    // The trigger POST itself failed (network/backend down) — retry restarts it.
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <ErrorState title={t('progress.triggerFailed')} onRetry={handleRetry} />
      </div>
    );
  } else if (timedOut && active) {
    // FE-009: never an infinite spinner — surface the honest timeout message
    // while polling continues in the background.
    content = (
      <div className="flex-1 flex items-center justify-center p-4">
        <ErrorState
          title={t('progress.timeoutTitle')}
          description={t('progress.timeoutDescription')}
          onRetry={handleRetry}
        />
      </div>
    );
  } else if (progress.status === 'partial') {
    content = <InvestigationPartialState onContinue={handleContinue} />;
  } else {
    // not_started (trigger in flight), starting, running, and complete (the
    // last frame before navigation) all render the live progress view.
    const statusKey =
      progress.status === 'not_started' ? 'starting' : progress.status;
    content = (
      <InvestigationProgressContent
        emailsReviewed={progress.emailsReviewed}
        categoriesSeen={progress.categoriesSeen}
        statusLabel={t(`status.${statusKey}`)}
        isActive={active}
      />
    );
  }

  return <div className="flex min-h-screen flex-col bg-gray-50">{content}</div>;
};

export default InvestigationProgressPage;
