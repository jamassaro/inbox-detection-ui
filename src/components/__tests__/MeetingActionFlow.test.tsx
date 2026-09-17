import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import i18n from '../../i18n';
import { ToastProvider } from '../../contexts/ToastProvider';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { stubWindowLocation } from '../../test-utils';
import MeetingActionFlow from '../MeetingActionFlow';
import { buildProposalSlots, parseProposedSlot } from '../../lib/proposalSlots';
import { ApiError } from '../../lib/apiError';
import { apiFetch } from '../../lib/apiClient';
import type { AgentActionWire } from '../../hooks/useAgentAction';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const DISCOVERY_ID = 'd1';
const PROPOSED_START = '2027-06-02T14:00:00.000Z';
const PROPOSED_END = '2027-06-02T15:00:00.000Z';

let wireAction = (overrides: Partial<AgentActionWire>): AgentActionWire => ({
  id: 'act_x',
  userId: 'u1',
  discoveryId: DISCOVERY_ID,
  actionType: 'create_calendar_event',
  permissionLevel: 2,
  status: 'awaiting_approval',
  requestPayload: {},
  resultPayload: null,
  verificationResult: null,
  approvedAt: null,
  executedAt: null,
  verifiedAt: null,
  failureReason: null,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
  ...overrides,
});

let calendarAction: AgentActionWire;
let draftAction: AgentActionWire;
let sendAction: AgentActionWire;
let actionsList: AgentActionWire[];
let approveResult: AgentActionWire;
let availability: { busy: { start: string; end: string }[] } | Error;
let createdEventBody: unknown;

const routeApi = async (url: string, init?: { method?: string; body?: unknown }) => {
  if (url === '/auth/me') {
    return { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };
  }
  if (url === '/billing/status') {
    return {
      plan: 'pro',
      subscriptionStatus: 'active',
      currentPeriodEnd: '2026-10-17T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      entitlements: {
        investigationEmailLimit: 25,
        visibleDiscoveryLimit: null,
        continuousMonitoring: true,
        reminders: true,
        calendarActions: true,
        emailActions: true,
        detectiveChatLimit: 20,
        historicalComparison: true,
        dailyBriefing: true,
        fullDiscoveryHistory: true,
      },
    };
  }
  if (url === '/account/connections') {
    return { gmail: { connected: true, email: 'ada@example.com' }, calendar: { connected: true }, gmailCompose: { enabled: true } };
  }
  if (url.startsWith('/calendar/availability')) {
    if (availability instanceof Error) throw availability;
    return availability;
  }
  if (url === '/actions?status=awaiting_approval') {
    return { actions: actionsList };
  }
  if (url.startsWith('/actions/') && url.endsWith('/approve')) {
    return approveResult;
  }
  if (url.startsWith('/actions/') && url.endsWith('/reject')) {
    return undefined;
  }
  if (url.startsWith('/calendar/connect')) {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/auth?client_id=test&scope=calendar&state=s1',
    };
  }
  if (url === '/calendar/events') {
    createdEventBody = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    return { id: 'evt_1', htmlLink: 'https://calendar.google.com/evt_1' };
  }
  if (url === '/gmail/draft') {
    return { draftId: 'draft_1', threadId: null, messageId: null };
  }
  if (url === '/gmail/send') {
    return { id: 'sent_1', threadId: null, messageId: 'msg_1' };
  }
  throw new Error(`Unexpected apiFetch: ${String(url)} ${String(init?.method)}`);
};

const renderFlow = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>{ui}</ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>,
  );
  return { ...rendered, queryClient };
};

beforeEach(() => {
  i18n.changeLanguage('en');
  mockApiFetch.mockReset();
  createdEventBody = null;
  availability = { busy: [] };
  calendarAction = wireAction({
    id: 'act_cal',
    actionType: 'create_calendar_event',
    requestPayload: {
      title: 'Coffee chat',
      start: PROPOSED_START,
      end: PROPOSED_END,
      attendees: ['ada@example.com'],
      description: 'Catch up',
    },
  });
  draftAction = wireAction({
    id: 'act_draft',
    actionType: 'draft_email',
    requestPayload: { to: 'ada@example.com', subject: 'Re: coffee', body: 'Booked you for 2pm.' },
  });
  sendAction = wireAction({ id: 'act_send', actionType: 'send_email', permissionLevel: 3, requestPayload: {} });
  actionsList = [calendarAction];
  approveResult = wireAction({ id: 'act_cal', status: 'approved' });
  mockApiFetch.mockImplementation(routeApi);
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('MeetingActionFlow — pure slot helpers', () => {
  it('parseProposedSlot falls back to a 60-minute hold when the end is missing', () => {
    const slot = parseProposedSlot({ start: '2027-06-02T14:00:00.000Z' });
    expect(slot).not.toBeNull();
    expect(slot?.start.toISOString()).toBe(PROPOSED_START);
    expect(slot?.end.toISOString()).toBe('2027-06-02T15:00:00.000Z');
  });

  it('parseProposedSlot rejects proposals without a usable start', () => {
    expect(parseProposedSlot({})).toBeNull();
    expect(parseProposedSlot({ start: 'not-a-date' })).toBeNull();
  });

  it('buildProposalSlots flags the proposed time as suggested when it is free', () => {
    const slots = buildProposalSlots(
      { start: PROPOSED_START, end: PROPOSED_END },
      [],
    );
    const suggested = slots.find((slot) => slot.suggested);
    expect(suggested?.start.toISOString()).toBe(PROPOSED_START);
    expect(suggested?.end.toISOString()).toBe(PROPOSED_END);
  });

  it('buildProposalSlots drops the proposed time when it overlaps a busy interval', () => {
    const slots = buildProposalSlots(
      { start: PROPOSED_START, end: PROPOSED_END },
      [{ start: '2027-06-02T13:30:00.000Z', end: '2027-06-02T14:30:00.000Z' }],
    );
    expect(slots.find((slot) => slot.suggested)).toBeUndefined();
  });
});

describe('MeetingActionFlow — happy path', () => {
  it('walks idle → proposing → approving → executing → done and books the chosen slot', async () => {
    renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));

    // Availability was fetched for the proposed day (BE-033) and the
    // proposed slot is offered as the suggested option.
    await screen.findByText('Suggested');
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/calendar/availability?start=2027-06-02T08%3A00%3A00.000Z&end=2027-06-02T20%3A00%3A00.000Z'));

    fireEvent.click(screen.getByRole('button', { name: /Suggested/ }));
    await screen.findByTestId('agent-approval');
    expect(screen.getByText(/Create meeting on/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByTestId('agent-done');
    expect(screen.getByText(/Event created:/)).toBeTruthy();
    expect(createdEventBody).toMatchObject({
      agentActionId: 'act_cal',
      title: 'Coffee chat',
      start: PROPOSED_START,
      end: PROPOSED_END,
      attendees: ['ada@example.com'],
    });
  });

  it('does not POST the event when the approve step reports a failed row', async () => {
    approveResult = wireAction({ id: 'act_cal', status: 'failed', failureReason: 'Calendar dispatch failed' });

    renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));
    await screen.findByText('Suggested');
    fireEvent.click(screen.getByRole('button', { name: /Suggested/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await screen.findByText('Calendar dispatch failed');
    expect(mockApiFetch.mock.calls.some(([url]) => String(url) === '/calendar/events')).toBe(false);
  });
});

describe('MeetingActionFlow — email follow-up', () => {
  it('creates the Gmail draft after booking, then sends it behind a Level 3 approval', async () => {
    actionsList = [calendarAction, draftAction, sendAction];
    renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));
    await screen.findByText('Suggested');
    fireEvent.click(screen.getByRole('button', { name: /Suggested/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    // Draft step: AI content rendered verbatim, Level 2 approval.
    await screen.findByText('Suggested reply');
    expect(screen.getByText('Booked you for 2pm.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Send step: red-level approval before anything leaves the inbox.
    await screen.findByText('Send this response?');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findAllByText('Response sent');
    const requestBodyOf = (url: string): unknown => {
      const call = mockApiFetch.mock.calls.find(([u]) => u === url);
      if (!call) throw new Error(`expected an apiFetch call to ${url}`);
      return JSON.parse((call[1] as { body: string }).body);
    };
    expect(requestBodyOf('/gmail/draft')).toMatchObject({
      agentActionId: 'act_draft',
      to: 'ada@example.com',
      subject: 'Re: coffee',
      body: 'Booked you for 2pm.',
    });
    expect(requestBodyOf('/gmail/send')).toEqual({
      agentActionId: 'act_send',
      draftId: 'draft_1',
    });
  });

  it('ends honestly at "event created" when no draft action exists', async () => {
    actionsList = [calendarAction];
    renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));
    await screen.findByText('Suggested');
    fireEvent.click(screen.getByRole('button', { name: /Suggested/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await screen.findByTestId('agent-done');
    expect(screen.queryByText('Suggested reply')).toBeNull();
  });
});

describe('MeetingActionFlow — calendar_not_connected redirect', () => {
  it('switches to the connect prompt and starts the Calendar OAuth flow', async () => {
    const location = stubWindowLocation();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    availability = new ApiError(400, 'bad_request', 'Calendar not connected', {
      error: 'calendar_not_connected',
      connectUrl: '/calendar/connect',
    });

    try {
      renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);
      fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));

      await screen.findByText('Connect Google Calendar so the Detective can find available times');
      fireEvent.click(screen.getByRole('button', { name: 'Connect Calendar' }));

      await waitFor(() => expect(location.href).toContain('accounts.google.com'));
      expect(location.href).toContain('calendar');
    } finally {
      consoleError.mockRestore();
      location.restore();
    }
  });
});

describe('MeetingActionFlow — no proposed action', () => {
  it('lands on the honest no-proposal state when the pipeline has not proposed a time', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    actionsList = [];
    try {
      renderFlow(<MeetingActionFlow discoveryId={DISCOVERY_ID} />);
      fireEvent.click(screen.getByRole('button', { name: 'Find a time' }));

      // Polls give the pipeline a few seconds before giving up.
      await screen.findByText("This request doesn't include a proposed time yet.", undefined, {
        timeout: 6000,
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
