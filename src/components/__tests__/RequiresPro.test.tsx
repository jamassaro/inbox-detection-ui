import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { AuthProvider } from '../../contexts/AuthContext';
import { EntitlementProvider } from '../../contexts/EntitlementContext';
import { apiFetch } from '../../lib/apiClient';
import RequiresPro from '../RequiresPro';
import type { Entitlements, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

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

describe('RequiresPro', () => {
  let queryClient: QueryClient;

  const renderGate = (ui: React.ReactNode) =>
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/app/chat']}>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <EntitlementProvider>{ui}</EntitlementProvider>
            </QueryClientProvider>
          </AuthProvider>
        </MemoryRouter>
      </I18nextProvider>,
    );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('renders children when the backend grants the feature (Pro plan)', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(PRO_ENTITLEMENTS); // /user/entitlements

    renderGate(
      <RequiresPro feature="reminders">
        <div>reminders UI</div>
      </RequiresPro>,
    );

    await waitFor(() => expect(screen.getByText('reminders UI')).toBeTruthy());
    expect(screen.queryByTestId('upgrade-prompt')).toBeNull();
  });

  it('renders children for a Pro user even when the feature flag is off', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce({ ...PRO_ENTITLEMENTS, calendarActions: false }); // /user/entitlements

    renderGate(
      <RequiresPro feature="calendarActions">
        <div>calendar UI</div>
      </RequiresPro>,
    );

    await waitFor(() => expect(screen.getByText('calendar UI')).toBeTruthy());
  });

  it('renders the default UpgradePrompt for a Free user', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(FREE_ENTITLEMENTS); // /user/entitlements

    renderGate(
      <RequiresPro feature="reminders">
        <div>reminders UI</div>
      </RequiresPro>,
    );

    await waitFor(() => expect(screen.getByTestId('upgrade-prompt')).toBeTruthy());
    expect(screen.queryByText('reminders UI')).toBeNull();
  });

  it('renders a custom fallback for a Free user when provided', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(FREE_ENTITLEMENTS); // /user/entitlements

    renderGate(
      <RequiresPro feature="reminders" fallback={<div>custom fallback</div>}>
        <div>reminders UI</div>
      </RequiresPro>,
    );

    await waitFor(() => expect(screen.getByText('custom fallback')).toBeTruthy());
    expect(screen.queryByTestId('upgrade-prompt')).toBeNull();
  });

  it('renders nothing while entitlements are unknown (loading)', () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockImplementationOnce(() => new Promise<Entitlements>(() => {})); // never resolves

    renderGate(
      <RequiresPro feature="reminders">
        <div>reminders UI</div>
      </RequiresPro>,
    );

    expect(screen.queryByText('reminders UI')).toBeNull();
    expect(screen.queryByTestId('upgrade-prompt')).toBeNull();
  });
});
