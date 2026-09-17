import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import AgentActionPanel, { type AgentActionState } from './AgentActionPanel';
import ActionButton from './ActionButton';
import CalendarConnectPrompt from './CalendarConnectPrompt';
import { useToast } from '../hooks/useToast';
import { useCalendarAvailability } from '../hooks/useCalendarAvailability';
import {
  availabilityWindow,
  buildProposalSlots,
  parseProposedSlot,
} from '../lib/proposalSlots';
import type { ProposalSlot } from '../lib/proposalSlots';
import { useCalendarStatus } from '../hooks/useCalendarStatus';
import {
  AGENT_ACTIONS_QUERY_KEY,
  selectLatestDiscoveryAction,
  useAgentActions,
  useApproveAgentAction,
  useRejectAgentAction,
} from '../hooks/useAgentAction';
import type { AgentActionWire, CalendarEventRequest } from '../hooks/useAgentAction';
import { useCreateCalendarEvent } from '../hooks/useCreateCalendarEvent';
import { useCreateGmailDraft, useSendGmailDraft } from '../hooks/useGmailActions';
import { apiFetch } from '../lib/apiClient';
import { isCalendarNotConnected } from '../lib/apiError';
import { formatMeetingTime } from '../lib/formatting';

/**
 * Meeting request action flow (FE-021) — "Find a time" on a meeting_request
 * discovery, wired to the verified Inbox-api contracts:
 *
 * - Agent actions (BE-032) are PROPOSED server-side; the client can only
 *   list/get/approve/reject. There is no "create action" endpoint, so the
 *   flow polls `GET /actions?status=awaiting_approval` for this discovery's
 *   `create_calendar_event` action and lands on an honest "no proposed time
 *   yet" state when none appears.
 * - Free slots come from `GET /calendar/availability` (`{ busy }`, BE-033);
 *   the proposed time is offered only when it does not overlap a busy
 *   interval.
 * - Booking is the approve-then-create pair: approve the action (Level 2),
 *   then `POST /calendar/events` with the chosen slot — the backend consumes
 *   the action (status → verified) only after Google accepts the event. The
 *   current backend's approve can also return a `failed` row (BE-042's
 *   dispatch integration is pending there) — that renders as the failed
 *   state with retry instead of being swallowed.
 * - The email reply is a separate Level 2 → Level 3 pair (`draft_email` →
 *   `POST /gmail/draft`, then `send_email` → `POST /gmail/send`, BE-034).
 *   Draft content is AI-generated — rendered verbatim, never through t().
 *
 * A 400 `{ error: 'calendar_not_connected' }` anywhere switches to
 * <CalendarConnectPrompt> so consent is requested contextually, not during
 * onboarding.
 */

/** How many times the flow polls for the discovery's proposed action before giving up. */
const FIND_ACTION_ATTEMPTS = 3;
/** Pause between polls — the proposing worker writes actions asynchronously. */
const FIND_ACTION_DELAY_MS = 1200;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface MeetingActionFlowProps {
  discoveryId: string;
  /** Discovery title — last-resort event title when the proposal carries none (AI text, as-is). */
  discoveryTitle?: string;
  /** Skip the idle "Find a time" step — used when resuming after the Calendar OAuth return. */
  autoStart?: boolean;
}

type MeetingPhase =
  | 'idle'
  | 'thinking'
  | 'proposing'
  | 'approving'
  | 'executing'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'connect';

/**
 * State machine owner for the meeting flow — the one place that turns
 * AgentActionPanel (a pure presenter, FE-019) into calendar API calls.
 */
const MeetingActionFlow = ({ discoveryId, discoveryTitle, autoStart = false }: MeetingActionFlowProps) => {
  const { t, i18n } = useTranslation('calendar');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: status } = useCalendarStatus();
  const approveAction = useApproveAgentAction();
  const rejectAction = useRejectAgentAction();
  const createEvent = useCreateCalendarEvent();

  const [phase, setPhase] = useState<MeetingPhase>(autoStart ? 'thinking' : 'idle');
  const [action, setAction] = useState<AgentActionWire | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ProposalSlot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [showNoAction, setShowNoAction] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const payload = useMemo<CalendarEventRequest>(
    () =>
      action && typeof action.requestPayload === 'object' && action.requestPayload !== null
        ? (action.requestPayload as CalendarEventRequest)
        : {},
    [action],
  );

  const dayWindow = useMemo(() => {
    const proposed = parseProposedSlot(payload);
    return proposed ? availabilityWindow(proposed.start) : null;
  }, [payload]);
  const availability = useCalendarAvailability(
    dayWindow ? dayWindow.start.toISOString() : null,
    dayWindow ? dayWindow.end.toISOString() : null,
    action !== null,
  );

  // Derived transitions instead of setState-in-effect: the availability
  // error and a known-disconnected status are rendered directly from the
  // async data — no phase mutation needed.
  const availabilityNotConnected =
    availability.isError && isCalendarNotConnected(availability.error);
  const availabilityFailed = availability.isError && !availabilityNotConnected;
  const connectNow =
    phase === 'connect' ||
    (phase === 'proposing' && availabilityNotConnected) ||
    (phase === 'idle' && status?.connected === false);

  const findCreateEventAction = useCallback(async (): Promise<AgentActionWire | undefined> => {
    for (let attempt = 0; attempt < FIND_ACTION_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await delay(FIND_ACTION_DELAY_MS);
      if (!mounted.current) return undefined;
      const wire = await apiFetch<{ actions: AgentActionWire[] }>('/actions?status=awaiting_approval');
      const found = selectLatestDiscoveryAction(wire.actions, discoveryId, 'create_calendar_event');
      if (found) return found;
    }
    return undefined;
  }, [discoveryId]);

  const handleStart = useCallback(async () => {
    setFailure(null);
    setShowNoAction(false);
    setSelectedSlot(null);
    setPhase('thinking');
    try {
      const found = await findCreateEventAction();
      if (!mounted.current) return;
      const foundPayload =
        found && typeof found.requestPayload === 'object' && found.requestPayload !== null
          ? (found.requestPayload as CalendarEventRequest)
          : {};
      if (!found || !parseProposedSlot(foundPayload)) {
        setShowNoAction(true);
        setPhase('idle');
        return;
      }
      setAction(found);
      setPhase('proposing');
    } catch (error) {
      if (!mounted.current) return;
      if (isCalendarNotConnected(error)) {
        setPhase('connect');
        return;
      }
      console.error('[MeetingActionFlow] failed to load the meeting proposal', error);
      setFailure(t('errors.actions'));
      setPhase('failed');
    }
  }, [findCreateEventAction, t]);

  const reset = useCallback(() => {
    setAction(null);
    setSelectedSlot(null);
    setFailure(null);
    setShowNoAction(false);
    setPhase('idle');
  }, []);

  const handleSelectSlot = useCallback(
    (selection: unknown) => {
      if (typeof selection !== 'string') return;
      const slotStart = new Date(selection);
      if (Number.isNaN(slotStart.getTime())) return;
      const slot = buildProposalSlots(payload, availability.data?.busy ?? []).find(
        (candidate) => candidate.start.getTime() === slotStart.getTime(),
      );
      if (!slot) return;
      setSelectedSlot(slot);
      setPhase('approving');
    },
    [payload, availability.data],
  );

  const handleConfirm = useCallback(async () => {
    if (!action || !selectedSlot) return;
    setPhase('executing');
    try {
      const approvedRow = await approveAction.mutateAsync(action.id);
      if (!mounted.current) return;
      if (approvedRow.status === 'failed') {
        setFailure(approvedRow.failureReason ?? t('errors.event'));
        setPhase('failed');
        return;
      }
      if (approvedRow.status !== 'verified') {
        // Consent recorded (status `approved`) — book the event on the
        // chosen slot; the backend consumes the action on success.
        await createEvent.mutateAsync({
          agentActionId: action.id,
          title: payload.title ?? discoveryTitle ?? t('meeting.defaultEventTitle'),
          start: selectedSlot.start.toISOString(),
          end: selectedSlot.end.toISOString(),
          ...(payload.attendees?.length && { attendees: payload.attendees }),
          ...(payload.description && { description: payload.description }),
        });
        if (!mounted.current) return;
      }
      // The action row just became `verified` server-side — observe it.
      setPhase('verifying');
      await queryClient.refetchQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY });
      if (!mounted.current) return;
      setPhase('done');
      toast.success(t('meeting.eventCreatedToast'));
    } catch (error) {
      if (!mounted.current) return;
      if (isCalendarNotConnected(error)) {
        setPhase('connect');
        return;
      }
      console.error('[MeetingActionFlow] failed to create the calendar event', error);
      setFailure(t('errors.event'));
      setPhase('failed');
    }
  }, [action, selectedSlot, approveAction, createEvent, payload, discoveryTitle, t, queryClient, toast]);

  const handleCancel = useCallback(() => {
    // Cancel = abandon the approval; the reject keeps the audit trail honest.
    // A reject of a non-awaiting action is a 400 — the UI has already moved
    // on, so the error is logged, not surfaced.
    if (action) {
      rejectAction.mutate(action.id, {
        onError: (error) => {
          console.error('[MeetingActionFlow] could not reject the action', error);
        },
      });
    }
    reset();
  }, [action, rejectAction, reset]);

  const slots = useMemo(
    () => (availability.data ? buildProposalSlots(payload, availability.data.busy) : []),
    [payload, availability.data],
  );

  const retry = useCallback(() => {
    // The availability query keeps its error until it refetches — a retry
    // after an availability failure must clear it, not just re-walk phases.
    if (availabilityFailed) void availability.refetch();
    void handleStart();
  }, [handleStart, availabilityFailed, availability]);

  if (connectNow) {
    return (
      <CalendarConnectPrompt
        discoveryId={discoveryId}
        returnPath={window.location.pathname + window.location.search}
      />
    );
  }

  const panelState: AgentActionState =
    phase === 'proposing' && availabilityFailed
      ? 'failed'
      : phase === 'proposing' && (availability.isLoading || !availability.data)
        ? 'thinking'
        : phase;

  return (
    <div data-testid="meeting-action-flow">
      <AgentActionPanel
        state={panelState}
        proposal={
          slots.length > 0 ? (
            <ul className="grid gap-2">
              {slots.map((slot) => (
                <li key={slot.start.toISOString()}>
                  <button
                    type="button"
                    data-proposal-selection={slot.start.toISOString()}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <span>{formatMeetingTime(slot.start, i18n.language)}</span>
                    {slot.suggested && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {t('meeting.suggested')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('meeting.noFreeSlots')}</p>
          )
        }
        onSelectProposal={handleSelectSlot}
        approvalDescription={
          selectedSlot
            ? t('meeting.approveCreate', { time: formatMeetingTime(selectedSlot.start, i18n.language) })
            : undefined
        }
        approvalLevel={2}
        onApprove={phase === 'approving' ? () => void handleConfirm() : undefined}
        onCancel={phase === 'approving' ? handleCancel : undefined}
        executingLabel={t('meeting.creating')}
        verifyingLabel={t('meeting.confirming')}
        resultSummary={
          selectedSlot
            ? t('meeting.done', { time: formatMeetingTime(selectedSlot.start, i18n.language) })
            : undefined
        }
        errorMessage={failure ?? (availabilityFailed ? t('errors.availability') : undefined)}
        onRetry={
          phase === 'failed' || (phase === 'proposing' && availabilityFailed) ? retry : undefined
        }
      >
        {phase === 'idle' && (
          <div>
            <ActionButton variant="primary" onClick={() => void handleStart()}>
              {t('meeting.findTimeCta')}
            </ActionButton>
            {showNoAction && (
              <p className="mt-2 text-sm text-gray-500">{t('meeting.noProposedTime')}</p>
            )}
          </div>
        )}
      </AgentActionPanel>

      {phase === 'done' && <EmailResponseFlow discoveryId={discoveryId} />}
    </div>
  );
};

interface EmailDraftPayload {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
}

/**
 * Email reply sub-flow (FE-021): renders after the meeting is booked, when
 * the pipeline has proposed a `draft_email` action for the discovery.
 * Level 2 approval creates the Gmail draft (content rides the route,
 * BE-034); Level 3 (red) approval sends it. Renders nothing when the
 * pipeline has not proposed a draft — the flow honestly ends at "event
 * created".
 */
export const EmailResponseFlow = ({ discoveryId }: { discoveryId: string }) => {
  const { t } = useTranslation('calendar');
  const toast = useToast();
  const queryClient = useQueryClient();

  // Live read of the shared awaiting-approval list — completed steps drop
  // out of the query as their actions are consumed, so the flow advances
  // against server state rather than shadow state.
  const actions = useAgentActions('awaiting_approval');
  const approveAction = useApproveAgentAction();
  const rejectAction = useRejectAgentAction();
  const createDraft = useCreateGmailDraft();
  const sendDraft = useSendGmailDraft();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [step, setStep] = useState<'draft' | 'send'>('draft');
  const [phase, setPhase] = useState<'confirm' | 'executing' | 'verifying' | 'done' | 'failed'>('confirm');
  const [failure, setFailure] = useState<string | null>(null);

  const draftAction = useMemo(
    () => actions.data?.actions
      ? selectLatestDiscoveryAction(actions.data.actions, discoveryId, 'draft_email')
      : undefined,
    [actions.data, discoveryId],
  );
  const sendAction = useMemo(
    () => actions.data?.actions
      ? selectLatestDiscoveryAction(actions.data.actions, discoveryId, 'send_email')
      : undefined,
    [actions.data, discoveryId],
  );

  const refetchActions = useCallback(async () => {
    await actions.refetch();
  }, [actions]);

  if (!draftAction) {
    return null;
  }

  const draft: EmailDraftPayload =
    typeof draftAction.requestPayload === 'object' && draftAction.requestPayload !== null
      ? (draftAction.requestPayload as EmailDraftPayload)
      : {};

  const handleDraftApprove = async () => {
    if (!draft.to || !draft.subject || !draft.body) {
      setFailure(t('errors.draft'));
      setPhase('failed');
      return;
    }
    setPhase('executing');
    try {
      const approvedRow = await approveAction.mutateAsync(draftAction.id);
      if (approvedRow.status === 'failed') {
        setFailure(approvedRow.failureReason ?? t('errors.draft'));
        setPhase('failed');
        return;
      }
      const created = await createDraft.mutateAsync({
        agentActionId: draftAction.id,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        ...(draft.threadId && { threadId: draft.threadId }),
      });
      setDraftId(created.draftId);
      toast.success(t('email.draftCreatedToast'));
      if (sendAction) {
        setStep('send');
        setPhase('confirm');
      } else {
        setPhase('done');
      }
    } catch (error) {
      console.error('[EmailResponseFlow] failed to create the draft', error);
      setFailure(t('errors.draft'));
      setPhase('failed');
    }
  };

  const handleSendApprove = async () => {
    if (!sendAction || !draftId) return;
    setPhase('executing');
    try {
      const approvedRow = await approveAction.mutateAsync(sendAction.id);
      if (approvedRow.status === 'failed') {
        setFailure(approvedRow.failureReason ?? t('errors.send'));
        setPhase('failed');
        return;
      }
      await sendDraft.mutateAsync({ agentActionId: sendAction.id, draftId });
      // The send route verified the action server-side — observe it.
      setPhase('verifying');
      await queryClient.refetchQueries({ queryKey: AGENT_ACTIONS_QUERY_KEY });
      setPhase('done');
      toast.success(t('email.sentToast'));
    } catch (error) {
      console.error('[EmailResponseFlow] failed to send the response', error);
      setFailure(t('errors.send'));
      setPhase('failed');
    }
  };

  const handleCancel = () => {
    const target = step === 'draft' ? draftAction : sendAction;
    if (target) {
      rejectAction.mutate(target.id, {
        onError: (error: unknown) => {
          console.error('[EmailResponseFlow] could not reject the action', error);
        },
      });
    }
    void refetchActions();
  };

  if (step === 'draft') {
    const panelState: AgentActionState = phase === 'confirm' ? 'approving' : phase;
    return (
      <div data-testid="email-response-flow" className="mt-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p className="font-medium text-gray-900">{t('email.draftHeading')}</p>
          <p className="mt-2 text-gray-600">
            <span className="font-medium">{t('email.draftToLabel')}:</span> {draft.to}
          </p>
          {draft.subject && (
            <p className="text-gray-600">
              <span className="font-medium">{t('email.draftSubjectLabel')}:</span> {draft.subject}
            </p>
          )}
          {/* AI-generated content — rendered verbatim, never translated. */}
          {draft.body && <p className="mt-2 whitespace-pre-wrap text-gray-800">{draft.body}</p>}
        </div>
        <AgentActionPanel
          state={panelState}
          approvalDescription={t('email.approveDraft')}
          approvalLevel={2}
          onApprove={phase === 'confirm' ? () => void handleDraftApprove() : undefined}
          onCancel={phase === 'confirm' ? handleCancel : undefined}
          executingLabel={t('email.creatingDraft')}
          verifyingLabel={t('meeting.confirming')}
          resultSummary={t('email.draftCreatedToast')}
          errorMessage={failure ?? undefined}
          onRetry={
            phase === 'failed'
              ? () => {
                  setFailure(null);
                  setPhase('confirm');
                  void refetchActions();
                }
              : undefined
          }
        />
      </div>
    );
  }

  const panelState: AgentActionState = phase === 'confirm' ? 'approving' : phase;
  return (
    <div data-testid="email-response-flow" className="mt-4">
      <AgentActionPanel
        state={panelState}
        approvalDescription={t('email.sendPrompt')}
        approvalLevel={3}
        onApprove={phase === 'confirm' ? () => void handleSendApprove() : undefined}
        onCancel={handleCancel}
        executingLabel={t('email.sending')}
        verifyingLabel={t('meeting.confirming')}
        resultSummary={t('email.sent')}
        errorMessage={failure ?? undefined}
        onRetry={
          phase === 'failed'
            ? () => {
                setFailure(null);
                setPhase('confirm');
                void refetchActions();
              }
            : undefined
        }
      />
    </div>
  );
};

export default MeetingActionFlow;
