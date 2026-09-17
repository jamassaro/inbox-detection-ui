import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { AuthProvider } from '../../../contexts/AuthProvider';
import { EntitlementProvider } from '../../../contexts/EntitlementProvider';
import { LocaleProvider } from '../../../contexts/LocaleProvider';
import { ToastProvider } from '../../../contexts/ToastProvider';
import { apiFetch } from '../../../lib/apiClient';
import { ApiError } from '../../../lib/apiError';
import { readUpgradeContext } from '../../../lib/upgradeContext';
import { stubWindowLocation } from '../../../test-utils';
import BillingPage from '../BillingPage';
import type { BillingStatusWire } from '../../../hooks/useBillingStatus';
import type { Entitlements, User } from '../../../types';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  visibleDiscoveries: 5,
  continuousMonitoring: false,
  reminders: false,
  calendarActions: false,
  emailActions: false,
  dailyBriefing: false,
  chatQuestionsRemaining: 3,
};

const PRO_ENTITLEMENTS: Entitlements = {
  plan: 'pro',
  visibleDiscoveries: 100,
  continuousMonitoring: true,
  reminders: true,
  calendarActions: true,
  emailActions: true,
  dailyBriefing: true,
  chatQuestionsRemaining: null,
};

const FREE_STATUS: BillingStatusWire = {
  plan: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: FREE_ENTITLEMENTS,
};

const PRO_ACTIVE_STATUS: BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: PRO_ENTITLEMENTS,
};

const PRO_CANCELLING_STATUS: BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: true,
  entitlements: PRO_ENTITLEMENTS,
};

const renderPage = (initialEntry = '/app/settings/billing') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <EntitlementProvider>
              <LocaleProvider>
                <ToastProvider>
                  <BillingPage />
                </ToastProvider>
              </LocaleProvider>
            </EntitlementProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const mockStatus = (status: BillingStatusWire) => {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/auth/me') return testUser;
    if (path === '/user/entitlements') {
      return status.plan === 'pro' ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
    }
    if (path === '/billing/status') return status;
    throw new Error(`unexpected apiFetch call: ${path}`);
  });
};

describe('BillingPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    void i18n.changeLanguage('en');
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the skeleton while billing status loads', () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return testUser;
      if (path === '/billing/status') return new Promise(() => {});
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
    renderPage();
    expect(screen.getByTestId('billing-skeleton')).toBeTruthy();
  });

  it('shows the error state when billing status fails and recovers via retry', async () => {
    let fail = true;
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return testUser;
      if (path === '/user/entitlements') return PRO_ENTITLEMENTS;
      if (path === '/billing/status') {
        if (fail) throw new ApiError(500, 'INTERNAL', 'boom');
        return PRO_ACTIVE_STATUS;
      }
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
    renderPage();
    expect(await screen.findByTestId('billing-error')).toBeTruthy();
    fail = false;
    fireEvent.click(
      screen.getByTestId('billing-error').querySelector('button') as HTMLButtonElement,
    );
    expect(await screen.findByTestId('billing-plan-value')).toBeTruthy();
  });

  it('renders the Free plan with an upgrade CTA and no portal button', async () => {
    mockStatus(FREE_STATUS);
    renderPage();
    expect(
      (await screen.findByTestId('billing-plan-value')).textContent,
    ).toBe('Free');
    expect(screen.getByTestId('billing-free-cta')).toBeTruthy();
    expect(screen.queryByTestId('manage-subscription')).toBeNull();
  });

  it('saves the billing-page upgrade context when the Free CTA is clicked', async () => {
    mockStatus(FREE_STATUS);
    renderPage();
    await userEvent.click(await screen.findByTestId('billing-free-cta'));
    const ctx = readUpgradeContext();
    expect(ctx).not.toBeNull();
    expect(ctx?.source).toBe('billing_page');
    expect(ctx?.returnPath).toBe('/app/settings/billing');
  });

  it('renders the Pro plan with status, renewal date, and pricing', async () => {
    mockStatus(PRO_ACTIVE_STATUS);
    renderPage();
    expect((await screen.findByTestId('billing-plan-value')).textContent).toBe('Pro');
    expect(screen.getByTestId('billing-status-badge').textContent).toBe('Active');
    expect(screen.getByTestId('billing-renewal').textContent).toBe('October 17, 2026');
    expect(screen.getByTestId('billing-price-monthly').textContent).toBe('$5.99');
    expect(screen.getByTestId('billing-price-annual').textContent).toBe('$49');
    expect(screen.getByTestId('manage-subscription')).toBeTruthy();
    expect(screen.queryByTestId('billing-free-cta')).toBeNull();
    expect(screen.queryByTestId('cancel-warning')).toBeNull();
  });

  it('flags the cancelling state with a renewal warning when cancelAtPeriodEnd is set', async () => {
    mockStatus(PRO_CANCELLING_STATUS);
    renderPage();
    expect(
      (await screen.findByTestId('billing-status-badge')).textContent,
    ).toBe('Cancelling');
    expect(screen.getByTestId('cancel-warning').textContent).toContain('October 17, 2026');
    expect(screen.getByTestId('billing-renewal').textContent).toBe('Ends October 17, 2026');
  });

  it('opens the Stripe portal via full-page redirect on the manage button', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return testUser;
      if (path === '/user/entitlements') return PRO_ENTITLEMENTS;
      if (path === '/billing/status') return PRO_ACTIVE_STATUS;
      if (path === '/billing/portal') return { portalUrl: 'https://billing.stripe.com/portal_1' };
      throw new Error(`unexpected apiFetch call: ${path}`);
    });
    const location = stubWindowLocation();
    renderPage();
    await userEvent.click(await screen.findByTestId('manage-subscription'));
    expect(location.assign).toHaveBeenCalledWith('https://billing.stripe.com/portal_1');
    location.restore();
  });

  it('shows an inline alert when the portal session cannot be created', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return testUser;
      if (path === '/user/entitlements') return PRO_ENTITLEMENTS;
      if (path === '/billing/status') return PRO_ACTIVE_STATUS;
      if (path === '/billing/portal') throw new ApiError(502, 'PORTAL_FAILED', 'boom');
      throw new Error(`unexpected apiFetch call: ${path}`);
    });
    renderPage();
    await userEvent.click(await screen.findByTestId('manage-subscription'));
    expect(await screen.findByTestId('portal-error')).toBeTruthy();
  });

  it('renders in Spanish when the app language is es', async () => {
    void i18n.changeLanguage('es');
    mockStatus(FREE_STATUS);
    renderPage();
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Facturación');
    void i18n.changeLanguage('en');
  });
});
