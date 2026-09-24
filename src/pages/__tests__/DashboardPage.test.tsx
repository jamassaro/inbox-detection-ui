import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import { DASHBOARD_WINDOW_LIMIT } from '../../hooks/useDashboard';
import type { DiscoveriesWire, DiscoveryWire } from '../../hooks/useInvestigation';
import type { BillingStatusWire, User } from '../../types';
import { apiFetch } from '../../lib/apiClient';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

// The greeting period depends on the wall clock; the page tests pin the KEY
// resolution (period → i18n key with {{name}} interpolation) by fixing the
// period to 'morning'. The hour-range logic itself is covered by
// greetingHelpers.test.ts.
vi.mock('../../lib/greetingHelpers', () => ({
  getGreetingPeriod: () => 'morning',
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireUser = (overrides: Partial<User> = {}): User => ({
  id: 'usr_1',
  displayName: 'María',
  email: 'maria@example.com',
  photoUrl: null,
  plan: 'pro',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  calendarConnected: true,
  gmailComposeEnabled: true,
  locale: 'en',
  createdAt: '2026-08-17T10:00:00.000Z',
  ...overrides,
});

/** Wire body of GET /billing/status (BE-030) — verified against Inbox-api src. */
const billingStatus = (plan: 'free' | 'pro'): BillingStatusWire => ({
  plan,
  subscriptionStatus: plan === 'pro' ? 'active' : null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: plan === 'pro' ? 2000 : 500,
    visibleDiscoveryLimit: plan === 'pro' ? null : 3, // Infinity → null over JSON
    continuousMonitoring: plan === 'pro',
    reminders: plan === 'pro',
    calendarActions: plan === 'pro',
    emailActions: plan === 'pro',
    detectiveChatLimit: plan === 'pro' ? null : 5,
    historicalComparison: plan === 'pro',
    dailyBriefing: plan === 'pro',
    fullDiscoveryHistory: plan === 'pro',
  },
});

/** Builds a realistic BE-028 wire row for GET /discoveries. */
const wireDiscovery = (overrides: Partial<DiscoveryWire> = {}): DiscoveryWire => ({
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
  availableActions: ['investigate', 'dismiss'],
  confidence: 0.9,
  ...overrides,
});

const wireResponse = (discoveries: DiscoveryWire[]): DiscoveriesWire => ({
  discoveries,
  total: discoveries.length,
  lockedCount: 0,
  pagination: { limit: DASHBOARD_WINDOW_LIMIT, offset: 0 },
});

interface BackendOptions {
  discoveries?: DiscoveryWire[];
  plan?: 'free' | 'pro';
  discoveriesPending?: boolean;
  discoveriesError?: boolean;
}

/** Wires mockApiFetch to the endpoints the dashboard page touches. */
const mockBackend = ({
  discoveries = [],
  plan = 'pro',
  discoveriesPending = false,
  discoveriesError = false,
}: BackendOptions = {}) => {
  // PATCH /discoveries/:id/dismiss is reflected in subsequent GET responses,
  // the way the backend would behave after a real dismissal.
  const dismissedIds = new Set<string>();
  mockApiFetch.mockImplementation((path: string) => {
    if (path.startsWith('/account/me')) return Promise.resolve(wireUser());
    if (path.startsWith('/billing/status')) return Promise.resolve(billingStatus(plan));
    // useGmailStatus composes the two real endpoints (BE-035 + BE-045).
    if (path === '/account/connections') {
      return Promise.resolve({
        gmail: { connected: true, email: 'maria@example.com' },
        calendar: { connected: true },
        gmailCompose: { enabled: true },
      });
    }
    if (path === '/stats') {
      return Promise.resolve({ lastScan: { scanDate: '2026-09-17T10:00:00.000Z' } });
    }
    if (path === `/discoveries?status=active&limit=${DASHBOARD_WINDOW_LIMIT}`) {
      if (discoveriesPending) return new Promise<DiscoveriesWire>(() => {});
      if (discoveriesError) return Promise.reject(new Error('discoveries unavailable'));
      return Promise.resolve(
        wireResponse(discoveries.filter((d) => !dismissedIds.has(d.id))),
      );
    }
    if (path.includes('/dismiss')) {
      dismissedIds.add(path.split('/')[2] ?? '');
      return Promise.resolve({ ...wireDiscovery(), status: 'dismissed' });
    }
    if (path === '/reminders?status=pending') return Promise.resolve({ reminders: [] });
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
};

/** Renders the destination pathname+search so navigation assertions can read the full URL. */
const DetailProbe = () => {
  const location = useLocation();
  return <div>probe:detail{location.pathname}{location.search}</div>;
};

/** Full provider stack in main.tsx order, with route probes for navigation. */
const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <LocaleProvider>
                <MemoryRouter initialEntries={['/app/dashboard']}>
                  <Routes>
                    <Route path="/app/dashboard" element={<DashboardPage />} />
                    <Route path="/app/discoveries" element={<div>probe:/app/discoveries</div>} />
                    <Route path="/app/discoveries/:id" element={<DetailProbe />} />
                    <Route path="/upgrade" element={<div>probe:/upgrade</div>} />
                  </Routes>
                </MemoryRouter>
              </LocaleProvider>
            </ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>,
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('greets the user by name and renders the three stats and priority cards from the API', async () => {
    mockBackend({
      discoveries: [
        wireDiscovery(),
        wireDiscovery({ id: 'd2', type: 'subscription', priority: 'medium', amount: 9.99, company: 'Spotify', title: 'Spotify went up' }),
        wireDiscovery({ id: 'd3', type: 'change', priority: 'high', amount: 4.5, company: 'AT&T', title: 'AT&T bill changed' }),
        wireDiscovery({ id: 'd4', type: 'money', priority: 'low', amount: 100, company: 'Acme', title: 'Acme credit' }),
        wireDiscovery({ id: 'd5', type: 'expiration', priority: 'urgent', amount: 20, company: 'Domain', title: 'Domain expires' }),
        wireDiscovery({ id: 'd6', type: 'expiration', priority: 'low', amount: null, company: 'Card', title: 'Gift card expires' }),
      ],
    });
    renderPage();

    // Personalized greeting (period fixed to morning by the module mock).
    expect(await screen.findByRole('heading', { name: 'Good morning, María.' })).toBeTruthy();

    // Stats: money = 15.49+9.99+4.5+100+20 = 149.98, subscriptions = 2, needs attention = 3.
    expect(await screen.findByText('$149.98')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();

    // Up to 5 cards, urgent first; the 6th row is cut.
    const cards = screen.getAllByTestId('discovery-card');
    expect(cards).toHaveLength(5);
    expect(cards[0]?.textContent).toContain('Domain expires');
    expect(screen.queryByText('Gift card expires')).toBeNull();

    // "See all discoveries" points at the full list.
    expect(screen.getByRole('link', { name: /See all discoveries/ }).getAttribute('href')).toBe(
      '/app/discoveries',
    );

    // Pro user: the briefing placeholder is visible.
    expect(screen.getByText('Daily Briefing')).toBeTruthy();
  });

  it('feeds the high-priority count to the agent status badge', async () => {
    mockBackend({ discoveries: [wireDiscovery()] });
    renderPage();

    // Connected, recently scanned, one high-priority row.
    expect(await screen.findByText(/Needs attention \(1 new\)/)).toBeTruthy();
  });

  it('renders the free-user upgrade prompt instead of the briefing', async () => {
    mockBackend({ plan: 'free', discoveries: [wireDiscovery()] });
    renderPage();

    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
    expect(screen.queryByText('Daily Briefing')).toBeNull();
  });

  it('renders the empty state with the monitoring message', async () => {
    mockBackend({ discoveries: [] });
    renderPage();

    expect(await screen.findByText('Nothing needs your attention right now')).toBeTruthy();
    expect(screen.getByText(/keeps monitoring your inbox/)).toBeTruthy();
  });

  it('renders skeleton cards while loading', async () => {
    mockBackend({ discoveriesPending: true });
    renderPage();

    expect(screen.getAllByTestId('skeleton-line').length).toBeGreaterThan(0);
  });

  it('renders the error state with a retry that refetches', async () => {
    const user = userEvent.setup();
    mockBackend({ discoveriesError: true });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('discovery-card')).toBeNull();

    mockBackend({ discoveries: [wireDiscovery()] });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('discovery-card')).toBeTruthy();
  });

  it('dismisses a card from the dashboard and removes it optimistically', async () => {
    const user = userEvent.setup();
    mockBackend({
      discoveries: [wireDiscovery(), wireDiscovery({ id: 'd2', title: 'Spotify went up' })],
    });
    renderPage();

    expect(await screen.findByText('Netflix renews at $15.49')).toBeTruthy();
    await user.click(screen.getAllByTestId('card-secondary-action-dismiss')[0]!);

    // Real PATCH with an empty body, optimistic removal, success toast.
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/dismiss', { method: 'PATCH' }),
    );
    await waitFor(() => expect(screen.getAllByTestId('discovery-card')).toHaveLength(1));
    expect(screen.queryByText('Netflix renews at $15.49')).toBeNull();
    expect(screen.getByText('Discovery dismissed.')).toBeTruthy();
  });

  it('opens the reminder dialog when a Pro user clicks remind', async () => {
    const user = userEvent.setup();
    mockBackend({ discoveries: [wireDiscovery({ availableActions: ['create_reminder'] })] });
    renderPage();

    expect(await screen.findByTestId('discovery-card')).toBeTruthy();
    await user.click(screen.getByTestId('card-primary-action'));

    // FE-020: the real reminder dialog replaces the coming-soon toast.
    expect(await screen.findByTestId('reminder-form')).toBeTruthy();
    expect(screen.queryByText('probe:/upgrade')).toBeNull();
  });

  it('shows the Free user the inline paywall when they click remind', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'free', discoveries: [wireDiscovery({ availableActions: ['create_reminder'] })] });
    renderPage();

    expect(await screen.findByTestId('discovery-card')).toBeTruthy();
    await user.click(screen.getByTestId('card-primary-action'));

    // FE-020: the Free paywall moved inside the reminder dialog — the page
    // itself no longer navigates to /upgrade. Scope to the dialog: the
    // dashboard also renders an unrelated daily-briefing upgrade prompt.
    const dialogs = screen.getAllByRole('dialog');
    expect(within(dialogs[0] as HTMLElement).getByTestId('upgrade-prompt')).toBeTruthy();
    expect(screen.queryByText('probe:/upgrade')).toBeNull();
  });

  it('renders no primary action for a view_evidence-only row — it would just duplicate the View button', async () => {
    mockBackend({ discoveries: [wireDiscovery({ availableActions: ['view_evidence'] })] });
    renderPage();

    expect(await screen.findByTestId('discovery-card')).toBeTruthy();
    expect(screen.queryByTestId('card-primary-action')).toBeNull();
    expect(screen.getByTestId('card-view-action')).toBeTruthy();
  });

  it('renders the dashboard copy in Spanish when the locale is es', async () => {
    await i18n.changeLanguage('es');
    mockBackend({ discoveries: [wireDiscovery()] });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Buenos días, María.' })).toBeTruthy();
    expect(screen.getByText('Dinero encontrado')).toBeTruthy();
    expect(screen.getByText('Requieren atención')).toBeTruthy(); // stat label
    expect(screen.getByText('Requieren tu atención')).toBeTruthy(); // section title
    expect(screen.getByRole('link', { name: /Ver todos los descubrimientos/ })).toBeTruthy();
  });
});
