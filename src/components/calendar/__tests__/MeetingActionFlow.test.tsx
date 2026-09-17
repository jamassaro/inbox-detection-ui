import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { AuthProvider } from '../../../contexts/AuthProvider';
import { EntitlementProvider } from '../../../contexts/EntitlementProvider';
import { ToastProvider } from '../../../contexts/ToastProvider';
import { apiFetch } from '../../../lib/apiClient';
import MeetingActionFlow from '../MeetingActionFlow';
import type { AgentActionWire } from '../../../hooks/useAgentAction';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const PRO_ENTITLEMENTS = {
  plan: 'pro',
  visibleDiscoveries: 100,
  continuousMonitoring: true,
  reminders: true,
  calendarActions: true,
  emailActions: true,
  dailyBriefing: true,
  chatQuestionsRemaining: null,
};

const HOUR = 3_600_000;
const START = new Date(Date.now() + 26 * HOUR);
const END = new Date(Date.now() + 27 * HOUR);

const action: AgentActionWire = {
  id: 'act_1',
  userId: 'u1',
  discoveryId: 'disc_1',
  actionType: 'create_calendar_event',
  permissionLevel: 2,
  status: 'proposed',
  requestPayload: {
    title: 'Renewal call',
    start: START.toISOString(),
    end: END.toISOString(),
    description: 'Discuss terms',
  },
  resultPayload: null,
  verificationResult: null,
  approvedAt: null,
  executedAt: null,
  verifiedAt: null,
  failureReason: null,
  createdAt: new Date(Date.now() - HOUR).toISOString(),
  updatedAt: new Date(Date.now() - HOUR).toISOString(),
};

let queryClient: QueryClient;

const renderFlow = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <MeetingActionFlow action={action} />
            </ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>,
  );

const mockBackend = ({ busy = [] as unknown[] }: { busy?: unknown[] } = {}) => {
  mockApiFetch.mockImplementation(((path: string, init?: { method?: string }) => {
    if (path === '/user/entitlements') return Promise.resolve(PRO_ENTITLEMENTS);
    if (path.includes('/account/connections')) {
      return Promise.resolve({ gmail: { connected: true, email: 'a@b.c' }, calendar: { connected: true }, gmailCompose: { enabled: true } });
    }
    if (path.startsWith('/calendar/availability')) return Promise.resolve({ busy });
    if (path.includes('/actions/act_1/approve')) {
      return Promise.resolve({ ...action, status: 'approved' });
    }
    if (path === '/calendar/events' && init?.method === 'POST') {
      return Promise.resolve({ id: 'evt_1', title: 'Renewal call', start: START.toISOString(), end: END.toISOString() });
    }
    return Promise.resolve({});
  }) as never);
};

describe('MeetingActionFlow', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('shows the connect CTA when Calendar is not connected', async () => {
    mockApiFetch.mockImplementation(((path: string) =>
      path.includes('/account/connections')
        ? Promise.resolve({ gmail: { connected: true, email: 'a@b.c' }, calendar: { connected: false }, gmailCompose: { enabled: false } })
        : Promise.resolve({})) as never);
    renderFlow();

    expect(await screen.findByTestId('meeting-connect-required')).toBeTruthy();
  });

  it('approves the proposal and books the proposed slot', async () => {
    mockBackend();
    renderFlow();

    const approval = await screen.findByTestId('agent-approval');
    expect(approval).toBeTruthy();
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/actions/act_1/approve', { method: 'POST' }),
    );
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/calendar/events', {
        method: 'POST',
        body: JSON.stringify({
          agentActionId: 'act_1',
          title: 'Renewal call',
          start: START.toISOString(),
          end: END.toISOString(),
          description: 'Discuss terms',
        }),
      }),
    );
    expect(await screen.findByTestId('agent-done')).toBeTruthy();
  });

  it('falls back to slot picking when the proposed time is busy', async () => {
    mockBackend({
      busy: [{ start: START.toISOString(), end: END.toISOString() }],
    });
    renderFlow();

    const proposals = await screen.findByTestId('meeting-slot-proposals');
    expect(proposals).toBeTruthy();

    fireEvent.click(proposals.querySelector('[data-proposal-selection="0"]') as HTMLElement);
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/calendar/events',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('surfaces a booking failure with a retry', async () => {
    mockApiFetch.mockImplementation(((path: string, init?: { method?: string }) => {
      if (path === '/user/entitlements') return Promise.resolve(PRO_ENTITLEMENTS);
      if (path.includes('/account/connections')) {
        return Promise.resolve({ gmail: { connected: true, email: 'a@b.c' }, calendar: { connected: true }, gmailCompose: { enabled: true } });
      }
      if (path.startsWith('/calendar/availability')) return Promise.resolve({ busy: [] });
      if (path.includes('/actions/act_1/approve')) {
        return Promise.resolve({ ...action, status: 'approved' });
      }
      if (path === '/calendar/events' && init?.method === 'POST') {
        return Promise.reject(new Error('calendar down'));
      }
      return Promise.resolve({});
    }) as never);
    renderFlow();

    fireEvent.click(await screen.findByText('Confirm'));
    expect(await screen.findByTestId('agent-failed')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
