import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoveryDetailPage from '../DiscoveryDetailPage';
import { apiFetch } from '../../../lib/apiClient';
import { ApiError } from '../../../lib/apiError';
import { EntitlementContext } from '../../../contexts/entitlementContext';
import type { EntitlementContextValue } from '../../../contexts/entitlementContext';
import { ToastProvider } from '../../../contexts/ToastProvider';
import { LocaleProvider } from '../../../contexts/LocaleProvider';
import i18n from '../../../i18n';
import type { DiscoveryWire } from '../../../lib/discoveryWire';
import type { Entitlements } from '../../../types';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const detailWire = (overrides: Partial<DiscoveryWire> = {}): DiscoveryWire => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'Netflix renews at $15.49',
  description: 'Standard plan, monthly renewal.',
  company: 'Netflix',
  amount: 15.49,
  currency: 'USD',
  eventDate: '2026-10-01',
  priority: 'high',
  status: 'active',
  isLocked: false,
  availableActions: ['remind', 'dismiss', 'view_source', 'ask_detective'],
  confidence: 0.9,
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

const evidenceResponse = () => ({
  discoveryId: 'disc-1',
  explanation: 'Flagged because the renewal date is within 7 days.',
  evidence: [
    {
      emailId: 'msg-1935c0a1',
      sender: 'Netflix <info@netflix.com>',
      subject: 'Your renewal is coming up',
      date: '2026-09-10T12:00:00.000Z',
      snippet: 'Your Standard plan renews on October 1 for $15.49.',
      company: 'Netflix',
    },
  ],
});

const entitlements = (plan: 'free' | 'pro'): Entitlements => ({
  plan,
  visibleDiscoveries: plan === 'pro' ? 100 : 5,
  continuousMonitoring: plan === 'pro',
  reminders: plan === 'pro',
  calendarActions: plan === 'pro',
  emailActions: plan === 'pro',
  dailyBriefing: plan === 'pro',
  chatQuestionsRemaining: plan === 'pro' ? null : 10,
});

const entitlementValue = (plan: 'free' | 'pro'): EntitlementContextValue => ({
  entitlements: entitlements(plan),
  isLoading: false,
  refresh: vi.fn(),
});

/** Route probes that surface the in-memory location (MemoryRouter doesn't touch window.location). */
const ChatProbe = () => {
  const location = useLocation();
  // Single template string — JSX interpolation would split the text into
  // separate nodes and break getByText matching. search already carries '?'.
  return <div>{`probe:chat${location.search}`}</div>;
};

const renderPage = ({ plan = 'pro' }: { plan?: 'free' | 'pro' } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementContext.Provider value={entitlementValue(plan)}>
            <ToastProvider>
              <MemoryRouter initialEntries={['/app/discoveries/disc-1']}>
                <Routes>
                  <Route path="/app/discoveries" element={<div>probe:discoveries-list</div>} />
                  <Route path="/app/discoveries/:id" element={<DiscoveryDetailPage />} />
                  <Route path="/app/chat" element={<ChatProbe />} />
                  <Route path="/upgrade" element={<div>probe:/upgrade</div>} />
                </Routes>
              </MemoryRouter>
            </ToastProvider>
          </EntitlementContext.Provider>
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>,
  );
};

describe('DiscoveryDetailPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('renders all discovery fields: company, type badge, importance, title, amount, date, summary', async () => {
    mockApiFetch.mockResolvedValue(detailWire());
    renderPage();

    expect(await screen.findByTestId('discovery-detail-page')).toBeTruthy();
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1');
    expect(screen.getByTestId('detail-company').textContent).toBe('Netflix');
    expect(screen.getByTestId('detail-type-badge').textContent).toBe('Subscription');
    expect(screen.getByTestId('detail-importance').textContent).toBe('High priority');
    // AI-generated title renders as-is (plain text, not translated)
    expect(screen.getByTestId('detail-title').textContent).toBe('Netflix renews at $15.49');
    expect(screen.getByTestId('detail-amount').textContent).toContain('$15.49');
    expect(screen.getByTestId('detail-date-block').textContent).toContain('October 1, 2026');
    expect(screen.getByTestId('detail-summary').textContent).toBe('Standard plan, monthly renewal.');
  });

  it('renders one action button per backend-provided action', async () => {
    mockApiFetch.mockResolvedValue(detailWire());
    renderPage();

    expect(await screen.findByTestId('detail-actions')).toBeTruthy();
    expect(screen.getByTestId('detail-action-remind')).toBeTruthy();
    expect(screen.getByTestId('detail-action-dismiss')).toBeTruthy();
    expect(screen.getByTestId('detail-action-view_source')).toBeTruthy();
    expect(screen.getByTestId('detail-action-ask_detective')).toBeTruthy();
  });

  it('renders skeletons while the discovery loads', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('discovery-detail-loading')).toBeTruthy();
  });

  it('renders the error state with retry and back button on failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('discovery-detail-error')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('detail-back')).toBeTruthy();
  });

  it('renders the paywall state when the backend answers 402 for a locked row', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(402, 'locked', 'Upgrade to Pro to unlock all your discoveries.'),
    );
    renderPage({ plan: 'free' });

    expect(await screen.findByTestId('discovery-detail-locked')).toBeTruthy();
    expect(screen.getByText('This discovery is locked')).toBeTruthy();
    expect(screen.queryByTestId('detail-title')).toBeFalsy();
  });

  it('dismiss flow: ConfirmModal first, PATCH /dismiss on confirm, then navigates back', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/discoveries/disc-1') return Promise.resolve(detailWire());
      if (path === '/discoveries/disc-1/dismiss') {
        expect(init?.method).toBe('PATCH');
        return Promise.resolve(detailWire({ status: 'dismissed' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${path}`));
    });
    renderPage();

    // Confirm modal must NOT have fired the API before the user confirms.
    await userEvent.click(await screen.findByTestId('detail-action-dismiss'));
    expect(await screen.findByText('Dismiss this discovery?')).toBeTruthy();
    const dismissCalls = mockApiFetch.mock.calls.filter(
      ([path]) => String(path) === '/discoveries/disc-1/dismiss',
    );
    expect(dismissCalls).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.some(([path]) => String(path) === '/discoveries/disc-1/dismiss'),
      ).toBe(true);
    });
    expect(await screen.findByText('probe:discoveries-list')).toBeTruthy();
  });

  it('routes ask_detective to the chat page with the discovery id', async () => {
    mockApiFetch.mockResolvedValue(detailWire());
    renderPage();

    await userEvent.click(await screen.findByTestId('detail-action-ask_detective'));
    expect(await screen.findByText('probe:chat?discoveryId=disc-1')).toBeTruthy();
  });

  it('opens the EmailDrawer from view_source, which lazily fetches the evidence', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/discoveries/disc-1') return Promise.resolve(detailWire());
      if (path === '/discoveries/disc-1/evidence') return Promise.resolve(evidenceResponse());
      return Promise.reject(new Error(`unexpected fetch: ${path}`));
    });
    renderPage();

    // No evidence fetch before the drawer opens.
    expect(
      mockApiFetch.mock.calls.some(([path]) => String(path) === '/discoveries/disc-1/evidence'),
    ).toBe(false);

    await userEvent.click(await screen.findByTestId('view-source-button'));
    expect(await screen.findByTestId('email-drawer-panel')).toBeTruthy();
    await screen.findByTestId('email-drawer-content');
    expect(
      mockApiFetch.mock.calls.some(([path]) => String(path) === '/discoveries/disc-1/evidence'),
    ).toBe(true);
  });

  it('feedback: clicking Useful PATCHes /feedback and shows the thanks state', async () => {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/discoveries/disc-1') return Promise.resolve(detailWire());
      if (path === '/discoveries/disc-1/feedback') {
        expect(JSON.parse(String(init?.body))).toEqual({ feedback: 'useful' });
        expect(init?.method).toBe('PATCH');
        return Promise.resolve({ success: true });
      }
      return Promise.reject(new Error(`unexpected fetch: ${path}`));
    });
    renderPage();

    await userEvent.click(await screen.findByTestId('feedback-useful'));
    expect(await screen.findByTestId('detail-feedback-thanks')).toBeTruthy();
  });

  it('gates remind behind the Pro paywall for Free users', async () => {
    mockApiFetch.mockResolvedValue(detailWire());
    renderPage({ plan: 'free' });

    await userEvent.click(await screen.findByTestId('detail-action-remind'));
    // RequiresPro path: the upgrade prompt renders, and no reminder API exists yet.
    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
  });
});
