import { useEffect, useRef, useState } from 'react';
import AgentActionPanel from '../../components/AgentActionPanel';
import LanguageSelector from '../../components/LanguageSelector';
import type { AgentActionState } from '../../components/AgentActionPanel';

const ALL_STATES: AgentActionState[] = [
  'thinking',
  'proposing',
  'approving',
  'executing',
  'verifying',
  'done',
  'failed',
];

const PROPOSAL_SLOTS = ['Tuesday at 1:00 PM', 'Tuesday at 2:00 PM', 'Wednesday at 10:30 AM'];

/**
 * Dev-only agent action panel gallery (FE-019). Not linked from any navigation;
 * exists to visually verify the 8-state machine and to capture PR evidence.
 * Mirrors the /dev/discovery-cards pattern — remove whenever the orchestrator
 * asks. Hardcoded headings are intentional (dev tooling).
 */
const AgentActionPanelDemoPage = () => {
  const [flowState, setFlowState] = useState<AgentActionState>('idle');
  const [selection, setSelection] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const later = (ms: number, next: () => void) => {
    timers.current.push(setTimeout(next, ms));
  };

  // Parent-owned transition demo: the panel is a pure presenter, so this page
  // plays the role a real parent (FE-020/FE-021) will play.
  const runFlow = () => {
    timers.current.forEach(clearTimeout);
    setFlowState('thinking');
    later(700, () => setFlowState('proposing'));
  };

  const selectSlot = (value: unknown) => {
    setSelection(String(value));
    setFlowState('approving');
  };

  const approve = () => {
    setFlowState('executing');
    later(1000, () => setFlowState('verifying'));
    later(2000, () => setFlowState('done'));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FE-019 agent action panel gallery</h1>
          <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
        </div>
        <LanguageSelector />
      </header>

      <section aria-label="All states">
        <h2 className="mb-3 text-lg font-semibold">All 8 states (idle omitted — it renders nothing)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400" data-state="idle">
            idle — renders nothing (or its children)
          </div>
          {ALL_STATES.map((state) => (
            <div key={state} className="min-w-0">
              <AgentActionPanel
                state={state}
                approvalDescription="Create meeting Tuesday at 2:00 PM?"
                proposal={
                  <ul className="space-y-2">
                    {PROPOSAL_SLOTS.map((slot) => (
                      <li key={slot}>
                        <button
                          type="button"
                          data-proposal-selection={slot}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          {slot}
                        </button>
                      </li>
                    ))}
                  </ul>
                }
                resultSummary="Meeting created for Tuesday at 2:00 PM."
                errorMessage="Calendar could not be reached."
                onApprove={() => {}}
                onCancel={() => {}}
                onRetry={() => {}}
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Approval levels">
        <h2 className="mb-3 text-lg font-semibold">Approval levels — Level 2 vs Level 3 (destructive)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Level 2 — standard</p>
            <AgentActionPanel
              state="approving"
              approvalLevel={2}
              approvalDescription="Add this subscription to your watchlist?"
              onApprove={() => {}}
              onCancel={() => {}}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Level 3 — destructive/send</p>
            <AgentActionPanel
              state="approving"
              approvalLevel={3}
              approvalDescription="Send the draft email to rental-ops@building.com?"
              onApprove={() => {}}
              onCancel={() => {}}
            />
          </div>
        </div>
      </section>

      <section aria-label="Interactive flow">
        <h2 className="mb-3 text-lg font-semibold">Parent-owned transitions (interactive)</h2>
        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <button
            type="button"
            onClick={runFlow}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Run proposal flow
          </button>
          {selection && <p className="text-xs text-gray-500" data-testid="last-selection">Selected: {selection}</p>}
          <AgentActionPanel
            state={flowState}
            approvalLevel={3}
            approvalDescription="Create meeting Tuesday at 2:00 PM?"
            proposal={
              <ul className="space-y-2">
                {PROPOSAL_SLOTS.map((slot) => (
                  <li key={slot}>
                    <button
                      type="button"
                      data-proposal-selection={slot}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      {slot}
                    </button>
                  </li>
                ))}
              </ul>
            }
            resultSummary="Meeting created for Tuesday at 2:00 PM."
            errorMessage="Calendar could not be reached."
            onSelectProposal={selectSlot}
            onApprove={approve}
            onCancel={() => setFlowState('idle')}
            onRetry={() => setFlowState('idle')}
          />
        </div>
      </section>
    </div>
  );
};

export default AgentActionPanelDemoPage;
