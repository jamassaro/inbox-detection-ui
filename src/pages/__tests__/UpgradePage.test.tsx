import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { apiFetch } from '../../lib/apiClient';
import { ApiError } from '../../lib/apiError';
import { makeTestUser, stubWindowLocation } from '../../test-utils';
import { readUpgradeContext, saveUpgradeContext } from '../../lib/upgradeContext';
import UpgradePage from '../UpgradePage';
import type { BillingStatusWire, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = makeTestUser();;

/** Wire body of GET /billing/status (BE-030) — verified against Inbox-api src. */
const FREE_STATUS: BillingStatusWire = {
  plan: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 500,
    visibleDiscoveryLimit: 5,
    continuousMonitoring: false,
    reminders: false,
    calendarActions: false,
    emailActions: false,
    detectiveChatLimit: 3,
    historicalComparison: false,
    dailyBriefing: false,
    fullDiscoveryHistory: false,
  },
};

const PRO_STATUS: BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 2000,
    visibleDiscoveryLimit: null, // Infinity serializes to null over JSON
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

/** Fresh QueryClient per render so tests never share cache state. */
const renderPage = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <EntitlementProvider>
              <UpgradePage />
            </EntitlementProvider>
          </QueryClientProvider>
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe('UpgradePage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    void i18n.changeLanguage('en');
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') return FREE_STATUS;
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    void i18n.changeLanguage('en');
  });

  it('renders Free and Pro plan cards with the default headline', async () => {
    renderPage('/upgrade');
    expect(await screen.findByTestId('plan-card-free')).toBeTruthy();
    expect(screen.getByTestId('plan-card-monthly')).toBeTruthy();
    expect(screen.getByTestId('plan-card-annual')).toBeTruthy();
    expect(screen.getByTestId('upgrade-headline').textContent).toBe(
      'Upgrade to Inbox Detective Pro',
    );
  });

  it.each([
    ['locked_discovery', 'Your Detective found more things worth your attention.'],
    ['reminder', 'Set reminders so you never miss a deadline.'],
    ['calendar', 'Unlock Calendar actions.'],
    ['chat_limit', 'Get unlimited Detective access.'],
    ['investigation_results', 'See everything your investigation found.'],
  ])('shows the contextual headline for ?from=%s', async (from, expected) => {
    renderPage(`/upgrade?from=${from}`);
    await screen.findByTestId('upgrade-headline');
    expect(screen.getByTestId('upgrade-headline').textContent).toBe(expected);
  });

  it('shows the default headline for an unknown ?from= value', async () => {
    renderPage('/upgrade?from=some_unknown_source');
    await screen.findByTestId('upgrade-headline');
    expect(screen.getByTestId('upgrade-headline').textContent).toBe(
      'Upgrade to Inbox Detective Pro',
    );
  });

  it('shows the annual save badge and plan pricing', async () => {
    renderPage('/upgrade');
    await screen.findByTestId('save-badge');
    expect(screen.getByTestId('save-badge').textContent).toContain('Save 31%');
    // Presentational pricing (FE-016): $5.99/month, $49/year.
    expect(screen.getByTestId('plan-card-monthly').textContent).toContain('$5.99');
    expect(screen.getByTestId('plan-card-monthly').textContent).toContain('month');
    expect(screen.getByTestId('plan-card-annual').textContent).toContain('$49');
    expect(screen.getByTestId('plan-card-annual').textContent).toContain('year');
  });

  it('shows the Free current-plan indicator for Free users', async () => {
    renderPage('/upgrade');
    expect(await screen.findByTestId('current-plan-free')).toBeTruthy();
  });

  it('shows a current-plan indicator instead of CTAs for Pro users', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') return PRO_STATUS;
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
    renderPage('/upgrade');
    // The indicator appears on both priced cards; CTAs are gone.
    const proIndicators = await screen.findAllByTestId('current-plan-pro');
    expect(proIndicators.length).toBe(2);
    expect(screen.queryByTestId('upgrade-cta-monthly')).toBeNull();
    expect(screen.queryByTestId('upgrade-cta-annual')).toBeNull();
  });

  it('links to /app/settings/billing for existing Pro subscribers', async () => {
    renderPage('/upgrade');
    expect(await screen.findByTestId('already-pro-link')).toBeTruthy();
    expect(screen.getByTestId('already-pro-link').getAttribute('href')).toBe(
      '/app/settings/billing',
    );
  });

  it('posts the configured monthly price ID to /billing/checkout and redirects', async () => {
    vi.stubEnv('VITE_STRIPE_PRICE_MONTHLY_ID', 'price_test_monthly');
    const location = stubWindowLocation();
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') return FREE_STATUS;
      if (path === '/billing/checkout' && options?.method === 'POST') {
        expect(JSON.parse(String(options.body))).toEqual({ priceId: 'price_test_monthly' });
        return { checkoutUrl: 'https://checkout.stripe.com/session_123' };
      }
      throw new Error(`unexpected apiFetch call: ${path}`);
    });

    renderPage('/upgrade');
    await userEvent.click(await screen.findByTestId('upgrade-cta-monthly'));

    await waitFor(() => {
      expect(location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/session_123');
    });
    location.restore();
  });

  it('shows the checkout error state when the backend refuses', async () => {
    vi.stubEnv('VITE_STRIPE_PRICE_ANNUAL_ID', 'price_test_annual');
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') return FREE_STATUS;
      if (path === '/billing/checkout') {
        throw new ApiError(400, 'INVALID_PRICE', 'Invalid price');
      }
      throw new Error(`unexpected apiFetch call: ${path}`);
    });

    renderPage('/upgrade');
    await userEvent.click(await screen.findByTestId('upgrade-cta-annual'));

    expect(await screen.findByTestId('checkout-error')).toBeTruthy();
  });

  it('shows the cancelled notice and keeps the upgrade context after ?cancelled=true', async () => {
    // BE-030 redirects to /billing/cancelled, which routes to /upgrade?cancelled=true.
    // The context is intentionally preserved so a retry still returns the user.
    saveUpgradeContext({ source: 'locked_discovery', returnPath: '/app/discoveries' });
    renderPage('/upgrade?cancelled=true');
    const notice = await screen.findByTestId('cancelled-notice');
    expect(notice.textContent).toContain('No charge was made');
    expect(readUpgradeContext()).not.toBeNull();
  });

  it('shows no cancelled notice without the query flag', async () => {
    renderPage('/upgrade');
    await screen.findByTestId('upgrade-headline');
    expect(screen.queryByTestId('cancelled-notice')).toBeNull();
  });
});
