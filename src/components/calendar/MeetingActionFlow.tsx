import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentActionWire } from '../../hooks/useAgentAction';
import { useApproveAgentAction } from '../../hooks/useAgentAction';
import { computeFreeSlots, useCalendarAvailability } from '../../hooks/useCalendarAvailability';
import { useCreateCalendarEvent } from '../../hooks/useCreateCalendarEvent';
import { useCalendarStatus, startCalendarConnect } from '../../hooks/useCalendarStatus';
import { useToast } from '../../hooks/useToast';
import { extractCalendarRequest, isSlotFree } from '../../lib/agentProposal';
import { formatMeetingTime } from '../../lib/formatting';
import AgentActionPanel from '../AgentActionPanel';
import RequiresPro from '../RequiresPro';

/** Booking window around the proposed meeting used to find alternative slots. */
const ALTERNATIVE_WINDOW_HOURS = 8;
const SLOT_MINUTES = 60;

/** Local UI machine for the booking flow — mirrored onto <AgentActionPanel> states. */
type FlowState = 'thinking' | 'proposing' | 'approving' | 'executing' | 'done' | 'failed';

interface MeetingActionFlowProps {
  action: AgentActionWire;
}

/**
 * Meeting scheduling flow for a `create_calendar_event` action (FE-021,
 * backend BE-033 + BE-032 approval). Shows the proposed meeting, checks the
 * user's Calendar availability, and books on approval — the action is
 * approved (BE-032) and consumed by `POST /calendar/events`.
 *
 * Free users see the RequiresPro upgrade path; not connected → consent CTA.
 */
const MeetingActionFlow = ({ action }: MeetingActionFlowProps) => {
  const { t, i18n } = useTranslation('calendar');
  const toast = useToast();

  const { data: status } = useCalendarStatus();
  const approveAction = useApproveAgentAction();
  const createEvent = useCreateCalendarEvent();

  const proposal = useMemo(() => extractCalendarRequest(action.requestPayload), [action]);
  // Derived once per proposal — a bare `new Date(proposal.start)` would be a
  // new object every render and destabilize the window memos below.
  const { proposedStart, hasValidProposal } = useMemo(() => {
    const start = proposal?.start !== undefined ? new Date(proposal.start) : null;
    const end = proposal?.end !== undefined ? new Date(proposal.end) : null;
    return {
      proposedStart: start,
      hasValidProposal:
        start !== null &&
        end !== null &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()),
    };
  }, [proposal]);

  // Availability window: the proposed day ± the alternative-search margin.
  const windowStart = useMemo(() => {
    if (proposedStart === null) return null;
    const start = new Date(proposedStart);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }, [proposedStart]);
  const windowEnd = useMemo(() => {
    if (proposedStart === null) return null;
    const end = new Date(proposedStart);
    end.setHours(24 + ALTERNATIVE_WINDOW_HOURS, 0, 0, 0);
    return end.toISOString();
  }, [proposedStart]);

  const connected = status?.connected === true;
  const availability = useCalendarAvailability(windowStart, windowEnd, connected && hasValidProposal);
  const busy = useMemo(() => availability.data?.busy ?? [], [availability.data]);

  const proposedIsFree = hasValidProposal && isSlotFree(proposedStart as Date, busy);
  const alternatives = useMemo(() => {
    if (!hasValidProposal || proposedStart === null || windowStart === null || windowEnd === null) {
      return [];
    }
    return computeFreeSlots(busy, new Date(windowStart), new Date(windowEnd), SLOT_MINUTES);
  }, [busy, hasValidProposal, proposedStart, windowStart, windowEnd]);

  const [chosen, setChosen] = useState<Date | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('approving');
  const [failure, setFailure] = useState<string | null>(null);

  // Once availability settles: a taken proposal drops the user into slot
  // picking instead of letting them approve a busy time. Derived in render —
  // the availability queries are the external state, not something to mirror
  // into flowState via an effect.
  const availabilitySettled = !availability.isPending && !availability.isError;
  const proposedSlotTaken = connected && availabilitySettled && chosen === null && !proposedIsFree;
  const state: FlowState = flowState === 'approving' && proposedSlotTaken ? 'proposing' : flowState;

  const book = async (slot: Date) => {
    setChosen(slot);
    setFlowState('executing');
    setFailure(null);
    try {
      await approveAction.mutateAsync(action.id);
      await createEvent.mutateAsync({
        agentActionId: action.id,
        title: proposal?.title ?? 'Meeting',
        start: slot.toISOString(),
        end: proposal?.end ?? new Date(slot.getTime() + SLOT_MINUTES * 60_000).toISOString(),
        attendees: proposal?.attendees,
        description: proposal?.description,
      });
      setFlowState('done');
      toast.success(t('meeting.eventCreatedToast'));
    } catch (error) {
      console.error('[MeetingActionFlow] booking failed', error);
      setFailure(t('errors.event'));
      setFlowState('failed');
    }
  };

  const onSelectProposal = (selection: unknown) => {
    const index = typeof selection === 'number' ? selection : Number(selection);
    const slot = Number.isInteger(index) ? alternatives[index] : undefined;
    if (slot === undefined) return;
    setChosen(slot.start);
    setFlowState('approving');
  };

  if (!connected) {
    return (
      <div
        className="rounded-xl border border-gray-200 bg-white p-4"
        data-testid="meeting-connect-required"
      >
        <p className="text-sm text-gray-700">{t('connect.title')}</p>
        <button
          type="button"
          onClick={() => void startCalendarConnect(window.location.pathname)}
          className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          {t('connect.cta')}
        </button>
      </div>
    );
  }

  if (!hasValidProposal) {
    return (
      <AgentActionPanel
        state="failed"
        errorMessage={t('meeting.noProposedTime')}
        onRetry={undefined}
      />
    );
  }

  if (availability.isPending) {
    return <AgentActionPanel state="thinking" thinkingLabel={t('meeting.confirming')} />;
  }

  if (availability.isError) {
    return <AgentActionPanel state="failed" errorMessage={t('errors.availability')} />;
  }

  const time = chosen ?? (proposedStart as Date);

  return (
    <RequiresPro feature="calendarActions">
      <AgentActionPanel
        state={state}
        proposal={
          state === 'proposing' ? (
            <div className="space-y-2" data-testid="meeting-slot-proposals">
              <p className="text-sm font-medium text-gray-900">{t('meeting.proposalHeading')}</p>
              {alternatives.length === 0 ? (
                <p className="text-sm text-gray-600">{t('meeting.slotUnavailable')}</p>
              ) : (
                alternatives.map((slot, index) => (
                  <button
                    key={slot.start.toISOString()}
                    type="button"
                    data-proposal-selection={index}
                    onClick={() => onSelectProposal(index)}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    {formatMeetingTime(slot.start, i18n.language)}
                  </button>
                ))
              )}
            </div>
          ) : undefined
        }
        approvalDescription={
          state === 'approving'
            ? t('meeting.approveCreate', { time: formatMeetingTime(time, i18n.language) })
            : undefined
        }
        approvalLevel={2}
        onApprove={state === 'approving' ? () => void book(time) : undefined}
        onCancel={state === 'approving' ? () => setFlowState('proposing') : undefined}
        executingLabel={t('meeting.creating')}
        resultSummary={
          state === 'done'
            ? t('meeting.done', { time: formatMeetingTime(time, i18n.language) })
            : undefined
        }
        errorMessage={state === 'failed' ? failure ?? undefined : undefined}
        onRetry={
          state === 'failed'
            ? () => {
                setFailure(null);
                setFlowState('approving'); // busy proposals re-derive to 'proposing'
              }
            : undefined
        }
      />
    </RequiresPro>
  );
};

export default MeetingActionFlow;
