import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReminderModal from '../ReminderModal';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import type { BillingStatusWire, User } from '../../types';
import type { ReminderWire } from '../../hooks/useReminders';
import { apiFetch } from '../../lib/apiClient';
import { makeTestUser } from '../../test-utils';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/**
 * Grabs the parsed JSON body of the first recorded apiFetch call whose path
 * matches, failing the test loudly when the expected call never happened.
 */
function recordedBody(path: string): Record<string, string> {
  const call = mockApiFetch.mock.calls.find(([p]) => p === path);
  if (!call) throw new Error(`expected an apiFetch call to ${path}`);
  return JSON.parse(String((call[1] as RequestInit).body)) as Record<string, string>;
}

const wireUser = (overrides: Partial<User> = {}): User => makeTestUser(overrides);

/** Wire body of GET /billing/status (BE-030) — EntitlementProvider's fetch. */
const billingStatus = (plan: 'free' | 'pro'): BillingStatusWire => ({
  plan,
  subscriptionStatus: plan === 'pro' ? 'active' : null,
  currentPeriodEnd: plan === 'pro' ? '2026-10-17T00:00:00.000Z' : null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: plan === 'pro' ? 2000 : 500,
    visibleDiscoveryLimit: plan === 'pro' ? null : 5,
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

const wireReminder = (overrides: Partial<ReminderWire> = {}): ReminderWire => ({
  id: 'rem_1',
  userId: 'usr_1',
  discoveryId: 'disc-1',
  title: 'Netflix renews at $15.49',
  description: null,
  remindAt: '2026-09-20T09:00:00.000Z',
  status: 'pending',
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

interface BackendOptions {
  plan?: 'free' | 'pro';
  reminders?: ReminderWire[];
  createError?: boolean;
}

/** Wires mockApiFetch to the endpoints the modal touches. */
const mockBackend = ({ plan = 'pro', reminders = [], createError = false }: BackendOptions = {}) => {
  mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/account/me')) return Promise.resolve(wireUser());
    if (path.startsWith('/billing/status')) return Promise.resolve(billingStatus(plan));
    if (path === '/reminders?status=pending') return Promise.resolve({ reminders });
    if (path === '/reminders') {
      if (createError) return Promise.reject(new Error('402'));
      return Promise.resolve({
        id: 'rem_new',
        title: 'Netflix renews at $15.49',
        remindAt: '2026-09-21T09:00:00.000Z',
        status: 'pending' as const,
      });
    }
    if (path === '/reminders/rem_1' && init?.method === 'PATCH') {
      return Promise.resolve(wireReminder({ remindAt: '2026-09-25T09:00:00.000Z' }));
    }
    if (path === '/reminders/rem_1' && init?.method === 'DELETE') {
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
};

/** Records the live router location so navigation assertions can read it. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderModal = (
  { discoveryDate, discoveryTitle }: { discoveryDate?: string; discoveryTitle?: string } = {},
  onClose = vi.fn(),
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <LocaleProvider>
                <MemoryRouter initialEntries={['/app/discoveries/disc-1']}>
                  <Routes>
                    <Route
                      path="/app/discoveries/:id"
                      element={
                        <>
                          <ReminderModal
                            discoveryId="disc-1"
                            discoveryDate={discoveryDate}
                            discoveryTitle={discoveryTitle}
                            isOpen
                            onClose={onClose}
                          />
                          <LocationProbe />
                        </>
                      }
                    />
                    <Route
                      path="/upgrade"
                      element={
                        <>
                          <div>probe:/upgrade</div>
                          <LocationProbe />
                        </>
                      }
                    />
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

describe('ReminderModal — Pro user', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    window.sessionStorage.clear();
  });

  // Portals render into document.body — auto-cleanup is off (vitest globals
  // disabled), so every test must wipe the DOM or testids stack up.
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('shows all five reminder options when the discovery has an event date', async () => {
    mockBackend({ plan: 'pro' });
    renderModal({ discoveryDate: '2026-10-01' });

    expect(await screen.findByTestId('reminder-form')).toBeTruthy();
    const options = screen.getAllByTestId('reminder-option');
    expect(options).toHaveLength(5);
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText('1 day before')).toBeTruthy();
    expect(screen.getByText('3 days before')).toBeTruthy();
    expect(screen.getByText('7 days before')).toBeTruthy();
    expect(screen.getByText('Pick a date and time')).toBeTruthy();
  });

  it('hides the days-before options without a discovery event date', async () => {
    mockBackend({ plan: 'pro' });
    renderModal();

    expect(await screen.findByTestId('reminder-form')).toBeTruthy();
    expect(screen.getAllByTestId('reminder-option')).toHaveLength(2);
    expect(screen.queryByText('1 day before')).toBeNull();
  });

  it('creates a reminder from an option, toasts the formatted date, and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockBackend({ plan: 'pro' });
    renderModal({ discoveryTitle: 'Netflix renews at $15.49' }, onClose);

    await screen.findByTestId('reminder-form');
    // Title prefilled from the discovery (backend requires a title).
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Netflix renews at $15.49',
    );
    await user.click(screen.getByText('Tomorrow'));
    await user.click(screen.getByTestId('reminder-submit'));

    await waitFor(() => {
      const body = recordedBody('/reminders');
      expect(body).toMatchObject({ discoveryId: 'disc-1', title: 'Netflix renews at $15.49' });
      // Tomorrow ≈ now + 1 day — a valid ISO timestamp within ±2h of that.
      const skew = Math.abs(new Date(body.remindAt).getTime() - (Date.now() + 24 * 3600_000));
      expect(skew).toBeLessThan(2 * 3600_000);
    });
    await waitFor(() => expect(screen.getByText(/Reminder set for/)).toBeTruthy());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('creates a reminder from a custom date and time', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'pro' });
    renderModal({ discoveryTitle: 'Netflix renews' });

    await screen.findByTestId('reminder-form');
    await user.click(screen.getByText('Pick a date and time'));
    expect(screen.getByTestId('custom-date-inputs')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:30' } });
    await user.click(screen.getByTestId('reminder-submit'));

    await waitFor(() => {
      const body = recordedBody('/reminders');
      // Sandbox runs UTC: the local wall-clock combination round-trips exactly.
      expect(body.remindAt).toBe('2026-09-20T10:30:00.000Z');
    });
  });

  it('shows the backend error inline and keeps the modal open', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'pro', createError: true });
    renderModal({ discoveryTitle: 'Netflix renews' });

    await screen.findByTestId('reminder-form');
    await user.click(screen.getByTestId('reminder-submit'));

    expect(await screen.findByTestId('reminder-error')).toBeTruthy();
    expect(screen.getByTestId('reminder-error').textContent).toBe(
      "We couldn't set the reminder. Please try again.",
    );
  });

  it('rejects an empty title without calling the backend', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'pro' });
    renderModal({ discoveryTitle: '' });

    await screen.findByTestId('reminder-form');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    await user.click(screen.getByTestId('reminder-submit'));

    expect(screen.getByTestId('reminder-error').textContent).toBe('Give the reminder a title.');
    expect(mockApiFetch.mock.calls.filter(([p]) => p === '/reminders')).toHaveLength(0);
  });

  describe('with an existing reminder', () => {
    it('shows the set confirmation with edit and cancel options', async () => {
      mockBackend({ plan: 'pro', reminders: [wireReminder()] });
      renderModal();

      expect(await screen.findByTestId('existing-reminder')).toBeTruthy();
      expect(screen.getByText(/Reminder set: September 20, 2026/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel reminder' })).toBeTruthy();
    });

    it('reschedules through the edit flow (PATCH)', async () => {
      const user = userEvent.setup();
      mockBackend({ plan: 'pro', reminders: [wireReminder()] });
      renderModal();

      await screen.findByTestId('existing-reminder');
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      // Edit mode prefills the custom inputs from the existing reminder.
      expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-09-20');
      expect(screen.getByText('Pick a new time')).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-25' } });
      await user.click(screen.getByTestId('reminder-submit'));

      await waitFor(() => {
        expect(recordedBody('/reminders/rem_1')).toEqual({
          remindAt: '2026-09-25T09:00:00.000Z',
        });
      });
      await waitFor(() => expect(screen.getByText(/Reminder updated to/)).toBeTruthy());
    });

    it('cancels through the ConfirmModal (DELETE) with a toast', async () => {
      const user = userEvent.setup();
      mockBackend({ plan: 'pro', reminders: [wireReminder()] });
      renderModal();

      await screen.findByTestId('existing-reminder');
      await user.click(screen.getByRole('button', { name: 'Cancel reminder' }));

      // ConfirmModal stacks on the ReminderModal — scope to its own dialog.
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);
      const confirmDialog = within(dialogs[1] as HTMLElement);
      expect(
        confirmDialog.getByText("You won't get a reminder for this. This can't be undone."),
      ).toBeTruthy();
      await user.click(confirmDialog.getByRole('button', { name: 'Cancel reminder' }));

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', { method: 'DELETE' }),
      );
      await waitFor(() => expect(screen.getByText('Reminder cancelled')).toBeTruthy());
    });
  });

  it('renders the modal in Spanish when the locale is es', async () => {
    await i18n.changeLanguage('es');
    mockBackend({ plan: 'pro' });
    renderModal({ discoveryDate: '2026-10-01' });

    expect(await screen.findByTestId('reminder-form')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recordarme' })).toBeTruthy();
    expect(screen.getByText('Mañana')).toBeTruthy();
    expect(screen.getByText('1 día antes')).toBeTruthy();
    expect(screen.getByText('Elegir fecha y hora')).toBeTruthy();
  });
});

describe('ReminderModal — Free user', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('shows the upgrade prompt inline instead of reminder options', async () => {
    mockBackend({ plan: 'free' });
    renderModal({ discoveryDate: '2026-10-01' });

    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
    expect(screen.queryByTestId('reminder-form')).toBeNull();
  });

  it('persists the full resumption context on unlock and navigates to /upgrade', async () => {
    const user = userEvent.setup();
    mockBackend({ plan: 'free' });
    renderModal({ discoveryDate: '2026-10-01' });

    const prompt = await screen.findByTestId('upgrade-prompt');
    await user.click(within(prompt).getByRole('button'));

    await waitFor(() => expect(screen.getByText('probe:/upgrade')).toBeTruthy());
    const stored = window.sessionStorage.getItem('inbox-detective-upgrade-context');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({
      source: 'reminder',
      returnPath: '/app/discoveries/disc-1',
      discoveryId: 'disc-1',
      pendingAction: 'create_reminder',
    });
    expect(screen.getByTestId('location').textContent).toBe('/upgrade?from=reminder');
  });
});
