import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { apiFetch } from '../../lib/apiClient';
import {
  clearUpgradeContext,
  readUpgradeContext,
  saveUpgradeContext,
} from '../../lib/upgradeContext';
import {
  ENTITLEMENT_MAX_POLL_ATTEMPTS,
  ENTITLEMENT_POLL_INTERVAL_MS,
} from '../UpgradeSuccessPage';
import UpgradeSuccessPage from '../UpgradeSuccessPage';
import { makeTestUser } from '../../test-utils';
import type { BillingStatusWire, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = makeTestUser();

/** Wire body of GET /billing/status (BE-030) for the given plan — the real
 * entitlements surface (there is no /user/entitlements on the backend). */
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

/** Destination route for a specific discovery — also reports its query string. */
const DiscoveryDestinationProbe = () => {
  const location = useLocation();
  return <div data-testid="discovery-detail-destination" data-search={location.search} />;
};

/** Destination routes registered so navigation assertions can observe them. */
const renderPage = (initialEntry = '/billing/success') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <EntitlementProvider>
              <ToastProvider>
                <Routes>
                  <Route path="/billing/success" element={<UpgradeSuccessPage />} />
                  <Route
                    path="/app/discoveries"
                    element={<div data-testid="discoveries-destination" />}
                  />
                  <Route path="/app/discoveries/:id" element={<DiscoveryDestinationProbe />} />
                  <Route path="/app/chat" element={<div data-testid="chat-destination" />} />
                </Routes>
              </ToastProvider>
            </EntitlementProvider>
          </QueryClientProvider>
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const mockPro = () => {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/account/me') return testUser;
    if (path === '/billing/status') return billingStatus('pro');
    throw new Error(`unexpected apiFetch path: ${path}`);
  });
};

describe('UpgradeSuccessPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    void i18n.changeLanguage('en');
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the activating state while the first poll is in flight', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('activating-state')).toBeTruthy();
  });

  it('redirects to the saved upgrade context path and clears the context on success', async () => {
    saveUpgradeContext({ source: 'locked_discovery', returnPath: '/app/chat' });
    mockPro();
    renderPage();
    expect(await screen.findByTestId('chat-destination', {}, { timeout: 6000 })).toBeTruthy();
    // Context is consumed exactly once (FE-017).
    expect(readUpgradeContext()).toBeNull();
    // Success toast fires before navigation so it survives the route change.
    expect(await screen.findByText('Welcome to Pro!')).toBeTruthy();
  });

  it('resumes a pending reminder on the discovery it was interrupted on (FE-020)', async () => {
    saveUpgradeContext({
      source: 'reminder',
      returnPath: '/app/discoveries/disc-1',
      discoveryId: 'disc-1',
      pendingAction: 'create_reminder',
    });
    mockPro();
    renderPage();
    expect(
      await screen.findByTestId('discovery-detail-destination', {}, { timeout: 6000 }),
    ).toBeTruthy();
    // The entry point rides along: DiscoveryDetailPage auto-opens the
    // ReminderModal when it sees openReminder=true, then clears the param.
    expect(
      screen.getByTestId('discovery-detail-destination').getAttribute('data-search'),
    ).toBe('?openReminder=true');
    expect(readUpgradeContext()).toBeNull();
  });

  it('falls back to the discoveries path when no context was saved', async () => {
    clearUpgradeContext();
    mockPro();
    renderPage();
    expect(
      await screen.findByTestId('discoveries-destination', {}, { timeout: 6000 }),
    ).toBeTruthy();
  });

  it('surfaces the manual-refresh state after the polling cap on a stuck webhook', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') return billingStatus('free');
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
    vi.useFakeTimers();
    renderPage();
    // RTL's waitFor cannot advance vitest fake timers, so flush microtasks
    // synchronously: first poll runs immediately and finds Free.
    await act(async () => {});
    expect(screen.getByTestId('activating-state')).toBeTruthy();
    // Advance past the full cap (12 attempts x 2s) with async advancement so
    // React state updates flush between intervals.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        ENTITLEMENT_POLL_INTERVAL_MS * ENTITLEMENT_MAX_POLL_ATTEMPTS + 1_000,
      );
    });
    expect(screen.getByTestId('timeout-state')).toBeTruthy();
    // Manual refresh restarts the poll loop instead of dead-ending.
    fireEvent.click(screen.getByTestId('manual-refresh'));
    expect(screen.getByTestId('activating-state')).toBeTruthy();
  });

  it('shows the error state when entitlements fail and recovers via retry', async () => {
    let fail = true;
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/account/me') return testUser;
      if (path === '/billing/status') {
        if (fail) throw new Error('entitlements unavailable');
        return billingStatus('pro');
      }
      throw new Error(`unexpected apiFetch path: ${path}`);
    });
    renderPage();
    expect(await screen.findByTestId('error-state')).toBeTruthy();
    fail = false;
    fireEvent.click(
      screen.getByTestId('error-state').querySelector('button') as HTMLButtonElement,
    );
    expect(
      await screen.findByTestId('discoveries-destination', {}, { timeout: 6000 }),
    ).toBeTruthy();
  });
});
