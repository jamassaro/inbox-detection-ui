import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import ActionButton from './ActionButton';

export type AgentActionState =
  | 'idle'
  | 'thinking'
  | 'proposing'
  | 'approving'
  | 'executing'
  | 'verifying'
  | 'done'
  | 'failed';

export interface AgentActionPanelProps {
  state: AgentActionState;
  /** Proposing state — e.g. a list of time slots. */
  proposal?: ReactNode;
  /**
   * Fires when the user picks one of the proposal's selectable items.
   * Proposal children annotate options with `data-proposal-selection="<value>"`;
   * the panel delegates clicks and passes the value through as `unknown`.
   */
  onSelectProposal?: (selection: unknown) => void;
  /** Approving state — "Create meeting Tuesday at 2:00 PM?" */
  approvalDescription?: string;
  /** Level 2 = standard, Level 3 = destructive/send. Level 3 is red and unmistakable. */
  approvalLevel?: 2 | 3;
  onApprove?: () => void;
  onCancel?: () => void;
  /** Done state — outcome summary, not internal reasoning. */
  resultSummary?: ReactNode;
  /** Failed state — shown to the user as-is. */
  errorMessage?: string;
  onRetry?: () => void;
  /** All labels optional — defaults come from `detective.agentStates.*` translation keys. */
  thinkingLabel?: string;
  executingLabel?: string;
  verifyingLabel?: string;
  /** Rendered only while `state` is `idle` (the "renders nothing" default). */
  children?: ReactNode;
}

const PANEL_CLASS = 'rounded-xl border p-4';

/** Approving card treatment per approval level — Level 3 must never read as navigation. */
const APPROVAL_CARD: Record<2 | 3, string> = {
  2: 'border-gray-200 bg-white',
  3: 'border-red-300 bg-red-50',
};

const APPROVAL_TITLE: Record<2 | 3, string> = {
  2: 'text-sm font-semibold text-gray-900',
  3: 'text-sm font-bold text-red-900',
};

/**
 * Thinking indicator: three bouncing dots. `motion-safe:` keeps the animation
 * behind `prefers-reduced-motion: no-preference` — dots stay static otherwise.
 */
const ThinkingIndicator = () => (
  <span className="inline-flex items-end gap-1" aria-hidden="true">
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-2 w-2 rounded-full bg-gray-400 motion-safe:animate-bounce"
        style={{ animationDelay: `${dot * 150}ms` }}
      />
    ))}
  </span>
);

/**
 * Executing progress indicator: indeterminate spinner, also gated behind
 * `motion-safe:` so reduced-motion users get a static ring instead.
 */
const ExecutingIndicator = () => (
  <span
    className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
    aria-hidden="true"
  />
);

/**
 * Pure presenter for the agent action state machine (FE-019): thinking →
 * proposing → approving → executing → verifying → done/failed. Holds NO state
 * and makes NO API calls — the parent (FE-020 reminders, FE-021 calendar, email
 * sending) owns every transition and passes outcomes as props. The only DOM
 * event it owns is click delegation over `data-proposal-selection` elements.
 */
const AgentActionPanel = ({
  state,
  proposal,
  onSelectProposal,
  approvalDescription,
  approvalLevel = 2,
  onApprove,
  onCancel,
  resultSummary,
  errorMessage,
  onRetry,
  thinkingLabel,
  executingLabel,
  verifyingLabel,
  children,
}: AgentActionPanelProps) => {
  const { t } = useTranslation('detective');

  const handleProposalClick = (event: MouseEvent<HTMLDivElement>) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[data-proposal-selection]');
    if (option) onSelectProposal?.(option.dataset.proposalSelection);
  };

  if (state === 'idle') {
    // Idle is invisible by default — parents pass children only when they want a placeholder.
    return children ? <>{children}</> : null;
  }

  return (
    <div className="text-sm" aria-live="polite" data-state={state}>
      {state === 'thinking' && (
        <div className={`${PANEL_CLASS} border-gray-200 bg-white`} role="status">
          <p className="flex items-center gap-2 font-medium text-gray-700">
            <ThinkingIndicator />
            {thinkingLabel ?? t('agentStates.thinking')}
          </p>
        </div>
      )}

      {state === 'proposing' && (
        <div className={PANEL_CLASS} data-testid="agent-proposal">
          <p className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            {t('agentStates.proposing')}
          </p>
          {proposal ? (
            <div onClick={handleProposalClick}>{proposal}</div>
          ) : (
            <p className="text-gray-500">{t('agentStates.proposalEmpty')}</p>
          )}
        </div>
      )}

      {state === 'approving' && (
        <div className={`${PANEL_CLASS} ${APPROVAL_CARD[approvalLevel]}`} data-testid="agent-approval">
          <p className={`mb-1 ${APPROVAL_TITLE[approvalLevel]}`}>{t('agentStates.approving')}</p>
          {approvalDescription && (
            <p className={approvalLevel === 3 ? 'font-semibold text-red-900' : 'text-gray-600'}>
              {approvalDescription}
            </p>
          )}
          {approvalLevel === 3 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('agentStates.destructiveWarning')}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <ActionButton variant="secondary" onClick={onCancel}>
              {t('agentStates.cancel')}
            </ActionButton>
            <ActionButton
              variant={approvalLevel === 3 ? 'destructive' : 'primary'}
              className={approvalLevel === 3 ? 'font-bold uppercase tracking-wide' : ''}
              onClick={onApprove}
            >
              {t('agentStates.confirm')}
            </ActionButton>
          </div>
        </div>
      )}

      {state === 'executing' && (
        <div className={`${PANEL_CLASS} border-gray-200 bg-white`} role="status">
          <p className="flex items-center gap-2 font-medium text-gray-700">
            <span className="text-gray-400">
              <ExecutingIndicator />
            </span>
            {executingLabel ?? t('agentStates.executing')}
          </p>
        </div>
      )}

      {state === 'verifying' && (
        <div className={`${PANEL_CLASS} border-gray-200 bg-white`} role="status">
          <p className="flex items-center gap-2 font-medium text-gray-700">
            <Loader2 className="h-4 w-4 text-gray-400" aria-hidden="true" />
            {verifyingLabel ?? t('agentStates.verifying')}
          </p>
        </div>
      )}

      {state === 'done' && (
        <div className={`${PANEL_CLASS} border-green-200 bg-green-50`} data-testid="agent-done">
          <p className="flex items-center gap-2 font-semibold text-green-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('agentStates.done')}
          </p>
          {resultSummary && <div className="mt-1 text-gray-700">{resultSummary}</div>}
        </div>
      )}

      {state === 'failed' && (
        <div className={`${PANEL_CLASS} border-red-200 bg-red-50`} data-testid="agent-failed">
          <p className="flex items-center gap-2 font-semibold text-red-800">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {errorMessage ?? t('agentStates.failed')}
          </p>
          {onRetry && (
            <div className="mt-3">
              <ActionButton variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('agentStates.retry')}
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentActionPanel;
