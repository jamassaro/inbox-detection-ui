import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../settings/SettingsPage';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import type { BillingStatusWire, User } from '../../types';
import { startCalendarConnect } from '../../hooks/useCalendarStatus';
import { apiFetch } from '../../lib/apiClient';
import { stubWindowLocation } from '../../test-utils';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Consent URL the mocked GET /calendar/connect hands back (FE-021/FE-023). */
const CONSENT_AUTH_URL = 'https://accounts.google.test/o/oauth2/v2/auth?client_id=test-client';

const wireUser = (overrides: Partial<User> = {}): User => ({
  id: 'usr_1',
  name: 'María',
  email: 'maria@example.com',
  googleId: 'google-1',
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

interface BackendOptions {
  plan?: 'free' | 'pro';
  gmailConnected?: boolean;
  calendarConnected?: boolean;
  /** Behavior of the GET /calendar/connect consent-URL request — default 'succeed'. */
  calendarConnect?: 'succeed' | 'fail';
}

/**
 * Wires mockApiFetch to every endpoint the settings page touches:
 * /auth/me, /billing/status, /gmail/status, /account/connections,
 * the two disconnect DELETEs, and the /calendar/connect consent-URL
 * request. Any other path fails loudly so a test can never silently pass
 * against an endpoint it did not stub.
 */
const mockBackend = ({
  plan = 'pro',
  gmailConnected = true,
  calendarConnected = true,
  calendarConnect = 'succeed',
}: BackendOptions = {}) => {
  mockApiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    if (path.startsWith('/auth/me')) return Promise.resolve(wireUser());
    if (path.startsWith('/billing/status')) return Promise.resolve(billingStatus(plan));
    if (path.startsWith('/gmail/status')) {
      return Promise.resolve({
        connected: gmailConnected,
        email: gmailConnected ? 'maria@example.com' : null,
        lastSync: gmailConnected ? '2026-09-17T10:00:00.000Z' : null,
      });
    }
    if (path === '/account/connections') {
      return Promise.resolve({
        gmail: { connected: gmailConnected, email: gmailConnected ? 'maria@example.com' : null },
        calendar: { connected: calendarConnected },
        gmailCompose: { enabled: plan === 'pro' },
      });
    }
    if (path === '/account/disconnect/gmail' && init?.method === 'DELETE') {
      return Promise.resolve({ disconnected: true });
    }
    if (path === '/account/disconnect/calendar' && init?.method === 'DELETE') {
      return Promise.resolve({ disconnected: true });
    }
    // GET /calendar/connect — the OAuth consent-URL request. Matched with
    // ANY query string via URL parsing: contextual flows (FE-021) append a
    // returnTo param, and letting this path fall through to the 'unexpected
    // path' catch-all was the flake observed during PR #31 verification
    // (the hook then hardcoded ?returnTo=%2Fapp%2Fsettings).
    if (new URL(path, 'http://inbox.test').pathname === '/calendar/connect') {
      if (calendarConnect === 'succeed') {
        return Promise.resolve({ authUrl: CONSENT_AUTH_URL });
      }
      return Promise.reject(new Error('calendar consent endpoint unavailable'));
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
};

/** Full provider stack in main.tsx order, with route probes for navigation. */
const renderPage = (initialPath = '/app/settings') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <LocaleProvider>
                <MemoryRouter initialEntries={[initialPath]}>
                  <Routes>
                    <Route path="/app/settings" element={<SettingsPage />} />
                    <Route path="/onboarding" element={<div>probe:/onboarding</div>} />
                    <Route path="/privacy" element={<div>probe:/privacy</div>} />
                    <Route path="/terms" element={<div>probe:/terms</div>} />
                    <Route path="*" element={<div>probe:404</div>} />
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

describe('SettingsPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  let locationStub: ReturnType<typeof stubWindowLocation> | null = null;

  afterEach(async () => {
    cleanup();
    locationStub?.restore();
    locationStub = null;
    await i18n.changeLanguage('en');
  });

  it('renders all four sections with read-only account details from the auth context', async () => {
    mockBackend();
    renderPage();

    expect(await screen.findByTestId('account-section')).toBeTruthy();
    expect(screen.getByTestId('account-name').textContent).toBe('María');
    expect(screen.getByTestId('account-email').textContent).toBe('maria@example.com');
    expect(screen.getByTestId('connected-accounts-section')).toBeTruthy();
    expect(screen.getByTestId('billing-section')).toBeTruthy();
    expect(screen.getByTestId('privacy-section')).toBeTruthy();
  });

  it('shows a connected Gmail row with the account email, last sync, and Disconnect button', async () => {
    mockBackend({ gmailConnected: true });
    renderPage();

    expect(await screen.findByTestId('gmail-disconnect')).toBeTruthy();
    expect(screen.getByTestId('gmail-last-synced').textContent).toMatch(/Last synced/);
    // The Gmail account email appears in the connected-accounts row (the
    // account section also shows it).
    expect(screen.getAllByText(/maria@example\.com/).length).toBeGreaterThan(0);
  });

  it('shows a not-connected Gmail row with a Connect Gmail link to /onboarding', async () => {
    mockBackend({ gmailConnected: false });
    renderPage();

    expect(await screen.findByTestId('gmail-connect')).toBeTruthy();
    expect(screen.getByTestId('gmail-connect').getAttribute('href')).toBe('/onboarding');
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.queryByTestId('gmail-disconnect')).toBeNull();
  });

  it('disconnects Gmail behind the ticket confirmation copy, then navigates to /onboarding', async () => {
    const user = userEvent.setup();
    mockBackend({ gmailConnected: true });
    renderPage();

    await user.click(await screen.findByTestId('gmail-disconnect'));

    // The ticket's specific consequence copy, verbatim, inside the modal.
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'Disconnecting Gmail will stop all monitoring and investigations. Your existing data is not deleted.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Disconnect Gmail' }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/account/disconnect/gmail', { method: 'DELETE' }),
    );
    await screen.findByText('probe:/onboarding');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the modal open with an error toast when the Gmail disconnect fails', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === '/account/disconnect/gmail' && init?.method === 'DELETE') {
        return Promise.reject(new Error('backend down'));
      }
      if (path.startsWith('/auth/me')) return Promise.resolve(wireUser());
      if (path.startsWith('/billing/status')) return Promise.resolve(billingStatus('pro'));
      if (path.startsWith('/gmail/status')) {
        return Promise.resolve({ connected: true, email: 'maria@example.com', lastSync: null });
      }
      if (path === '/account/connections') {
        return Promise.resolve({
          gmail: { connected: true, email: 'maria@example.com' },
          calendar: { connected: true },
          gmailCompose: { enabled: true },
        });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    renderPage();

    await user.click(await screen.findByTestId('gmail-disconnect'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect Gmail' }));

    expect(await screen.findByTestId('toast-error')).toBeTruthy();
    expect(screen.queryByText('probe:/onboarding')).toBeNull();
  });

  it('surfaces a Gmail status failure as an inline retryable error', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/auth/me')) return Promise.resolve(wireUser());
      if (path.startsWith('/billing/status')) return Promise.resolve(billingStatus('pro'));
      if (path.startsWith('/gmail/status')) return Promise.reject(new Error('backend down'));
      if (path === '/account/connections') {
        return Promise.resolve({
          gmail: { connected: false, email: null },
          calendar: { connected: false },
          gmailCompose: { enabled: false },
        });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('gmail-disconnect')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
  });

  it('disconnects Calendar behind its confirmation copy and stays on the settings page', async () => {
    const user = userEvent.setup();
    mockBackend({ calendarConnected: true });
    renderPage();

    await user.click(await screen.findByTestId('calendar-disconnect'));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'Disconnecting Google Calendar will remove calendar access. Existing discoveries and data are not deleted.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Disconnect Calendar' }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/account/disconnect/calendar', {
        method: 'DELETE',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Stays on /app/settings (no probe ever rendered) with rows re-fetched.
    expect(screen.queryByText('probe:/onboarding')).toBeNull();
    expect(screen.getByTestId('calendar-disconnect')).toBeTruthy();
  });

  it('offers Connect Calendar to a connected-status Pro user without a calendar', async () => {
    const user = userEvent.setup();
    locationStub = stubWindowLocation();
    mockBackend({ plan: 'pro', calendarConnected: false });
    renderPage();

    expect(await screen.findByTestId('calendar-connect')).toBeTruthy();
    expect(screen.queryByTestId('upgrade-prompt')).toBeNull();

    // The connect button starts the consent flow: GET /calendar/connect
    // (bare — the settings page relies on the backend's default redirect
    // back to Settings), then a full-page redirect to the returned authUrl.
    await user.click(screen.getByTestId('calendar-connect'));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/calendar/connect'),
    );
    expect(locationStub.href).toBe(CONSENT_AUTH_URL);
    expect(screen.queryByTestId('toast-error')).toBeNull();
  });

  it('starts the connect flow when the consent-URL request carries a returnTo param', async () => {
    locationStub = stubWindowLocation();
    mockBackend({ plan: 'pro', calendarConnected: false });

    // Regression (flake observed during PR #31 verification at eb8c8f7):
    // contextual flows request /calendar/connect?returnTo=... and the mock
    // must match it regardless of the query string instead of rejecting
    // with 'unexpected path: /calendar/connect?returnTo=%2Fapp%2Fsettings'.
    await expect(startCalendarConnect('/app/settings')).resolves.toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/calendar/connect?returnTo=%2Fapp%2Fsettings',
    );
    expect(locationStub.href).toBe(CONSENT_AUTH_URL);
  });

  it('still surfaces the connect error toast when the consent-URL request genuinely fails', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'pro', calendarConnected: false, calendarConnect: 'fail' });
    renderPage();

    await user.click(await screen.findByTestId('calendar-connect'));

    // The hardened matcher recognizes the consent-URL path, but a genuine
    // backend failure must still reach the user — never masked as a
    // successful redirect.
    expect(await screen.findByTestId('toast-error')).toBeTruthy();
  });

  it('shows the upgrade prompt instead of Connect Calendar for a Free user', async () => {
    mockBackend({ plan: 'free', calendarConnected: false });
    renderPage();

    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
    expect(screen.queryByTestId('calendar-connect')).toBeNull();
  });

  it('shows the current plan and a manage-billing link for Free and Pro users', async () => {
    mockBackend({ plan: 'free' });
    const { unmount } = renderPage();
    expect((await screen.findByTestId('billing-plan')).textContent).toBe('Free');
    expect(screen.getByTestId('manage-billing-link').getAttribute('href')).toBe(
      '/app/settings/billing',
    );
    unmount();

    cleanup();
    mockBackend({ plan: 'pro' });
    renderPage();
    await screen.findByTestId('billing-plan');
    await waitFor(() => expect(screen.getByTestId('billing-plan').textContent).toBe('Pro'));
  });

  it('links to the privacy policy and terms pages', async () => {
    mockBackend();
    renderPage();

    expect((await screen.findByTestId('privacy-policy-link')).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.getByTestId('terms-link').getAttribute('href')).toBe('/terms');
    expect(screen.getByTestId('delete-account-link').getAttribute('href')).toBe(
      '/app/settings/delete',
    );
  });

  it('logs out through the auth context', async () => {
    const user = userEvent.setup();
    mockBackend();
    renderPage();

    await user.click(await screen.findByTestId('logout-button'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST' }),
    );
  });

  it('re-renders all copy in Spanish when the language switches to es', async () => {
    const user = userEvent.setup();
    mockBackend({ gmailConnected: false, calendarConnected: false });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    // Both Gmail and Calendar rows show the not-connected copy. Async query:
    // the heading renders before the connections fetch resolves, so a sync
    // query races it and flakes on cold starts (CI).
    expect((await screen.findAllByText('Not connected')).length).toBe(2);

    // LanguageSelector labels its buttons via t('language') per locale —
    // the ES toggle's accessible name is "Idioma".
    await user.click(screen.getByRole('button', { name: 'Idioma' }));

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeTruthy();
    expect(screen.getAllByText('No conectado')).toHaveLength(2);
  });
});
