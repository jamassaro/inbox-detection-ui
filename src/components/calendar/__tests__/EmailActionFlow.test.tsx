import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { AuthProvider } from '../../../contexts/AuthProvider';
import { EntitlementProvider } from '../../../contexts/EntitlementProvider';
import { ToastProvider } from '../../../contexts/ToastProvider';
import { apiFetch } from '../../../lib/apiClient';
import EmailActionFlow from '../EmailActionFlow';
import type { AgentActionWire } from '../../../hooks/useAgentAction';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const PRO_BILLING_STATUS: import('../../../types').BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 0,
    visibleDiscoveryLimit: null,
    continuousMonitoring: true,
    reminders: true,
    calendarActions: true,
    emailActions: true,
    detectiveChatLimit: null,
    historicalComparison: true,
    dailyBriefing: true,
    fullDiscoveryHistory: true,
  },
};

const HOUR = 3_600_000;
const baseAction: AgentActionWire = {
  id: 'act_1',
  userId: 'u1',
  discoveryId: 'disc_1',
  actionType: 'draft_email',
  permissionLevel: 2,
  status: 'proposed',
  requestPayload: {
    to: 'vendor@example.com',
    subject: 'Re: upcoming renewal',
    body: 'Hi — can we discuss the new rate?',
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

const renderFlow = (action: AgentActionWire) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <EmailActionFlow action={action} />
            </ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>,
  );

const mockConnectedBackend = () => {
  mockApiFetch.mockImplementation(((path: string, init?: { method?: string }) => {
    if (path === '/billing/status') return Promise.resolve(PRO_BILLING_STATUS);
    if (path.includes('/account/connections')) {
      return Promise.resolve({ gmail: { connected: true, email: 'a@b.c' }, calendar: { connected: true }, gmailCompose: { enabled: true } });
    }
    if (path.includes('/approve')) return Promise.resolve({ ...baseAction, status: 'approved' });
    if (path === '/gmail/draft' && init?.method === 'POST') {
      return Promise.resolve({ id: 'draft_1', threadId: 'th_1' });
    }
    if (path === '/gmail/send' && init?.method === 'POST') {
      return Promise.resolve({ id: 'msg_1', threadId: 'th_1' });
    }
    return Promise.resolve({});
  }) as never);
};

describe('EmailActionFlow', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('shows the proposed draft content verbatim and posts it on approval', async () => {
    mockConnectedBackend();
    renderFlow(baseAction);

    const proposal = await screen.findByTestId('email-draft-proposal');
    expect(proposal.textContent).toContain('vendor@example.com');
    expect(proposal.textContent).toContain('Re: upcoming renewal');
    expect(proposal.textContent).toContain('Hi — can we discuss the new rate?');

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/gmail/draft', {
        method: 'POST',
        body: JSON.stringify({
          agentActionId: 'act_1',
          to: 'vendor@example.com',
          subject: 'Re: upcoming renewal',
          body: 'Hi — can we discuss the new rate?',
        }),
      }),
    );
    expect(await screen.findByTestId('agent-done')).toBeTruthy();
  });

  it('sends the referenced draft with a Level 3 destructive warning', async () => {
    mockConnectedBackend();
    renderFlow({ ...baseAction, id: 'act_3', actionType: 'send_email', permissionLevel: 3, requestPayload: { draftId: 'draft_9' } });

    const approval = await screen.findByTestId('agent-approval');
    expect(approval.textContent).toContain('This sends information outside Inbox Detective');

    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/gmail/send', {
        method: 'POST',
        body: JSON.stringify({ agentActionId: 'act_3', draftId: 'draft_9' }),
      }),
    );
    expect(await screen.findByTestId('agent-done')).toBeTruthy();
  });

  it('fails fast when a send action names no draft', async () => {
    mockConnectedBackend();
    renderFlow({ ...baseAction, id: 'act_4', actionType: 'send_email', permissionLevel: 3, requestPayload: {} });

    expect(await screen.findByTestId('agent-failed')).toBeTruthy();
    // The missing-draft failure is local — nothing is approved or sent.
    expect(mockApiFetch.mock.calls.filter(([p]) => p === '/gmail/send')).toHaveLength(0);
  });
});
