import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { apiFetch } from '../../lib/apiClient';
import ReminderModal from '../ReminderModal';
import type { Discovery, Entitlements } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

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

const discovery = {
  id: 'disc_1',
  userId: 'u1',
  type: 'subscription',
  title: 'Adobe renewal',
  company: 'Adobe',
  summary: 'Renews next month',
  confidence: 0.9,
  detectedAt: '2026-09-17T00:00:00.000Z',
  isLocked: false,
} as unknown as Discovery;

const wireReminder = {
  id: 'rem_1',
  userId: 'u1',
  discoveryId: 'disc_1',
  title: 'Adobe renewal',
  description: null,
  remindAt: '2026-09-20T09:00:00.000Z',
  status: 'pending',
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
};

const onClose = vi.fn();
let queryClient: QueryClient;

const renderModal = () =>
  render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <ReminderModal discovery={discovery} isOpen onClose={onClose} />
            </ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
      </I18nextProvider>
    </MemoryRouter>,
  );

describe('ReminderModal', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
    onClose.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('shows the upgrade path to a Free user', async () => {
    mockApiFetch.mockImplementation(((path: string) =>
      path.includes('/reminders') ? Promise.resolve({ reminders: [] }) : Promise.resolve(FREE_ENTITLEMENTS)) as never);
    renderModal();

    await waitFor(() => expect(screen.getByTestId('upgrade-prompt')).toBeTruthy());
    expect(screen.queryByText('Set reminder')).toBeNull();
  });

  it('creates a reminder with the exact POST body and closes the modal', async () => {
    mockApiFetch.mockImplementation(((path: string) =>
      path.includes('/reminders') ? Promise.resolve({ reminders: [] }) : Promise.resolve(PRO_ENTITLEMENTS)) as never);
    renderModal();

    await waitFor(() => expect(screen.getByText('Set reminder')).toBeTruthy());
    fireEvent.click(screen.getByText('Pick a date and time'));
    fireEvent.change(screen.getByLabelText('Date') as HTMLInputElement, { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Time') as HTMLInputElement, { target: { value: '15:30' } });
    fireEvent.click(screen.getByText('Set reminder'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/reminders', {
        method: 'POST',
        body: JSON.stringify({
          discoveryId: 'disc_1',
          title: 'Adobe renewal',
          remindAt: new Date(2026, 8, 20, 15, 30).toISOString(),
        }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('blocks submit with a validation error for an empty title', async () => {
    mockApiFetch.mockImplementation(((path: string) =>
      path.includes('/reminders') ? Promise.resolve({ reminders: [] }) : Promise.resolve(PRO_ENTITLEMENTS)) as never);
    renderModal();

    await waitFor(() => expect(screen.getByText('Set reminder')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Set reminder'));

    expect(await screen.findByText('Give the reminder a title.')).toBeTruthy();
  });

  it('shows the existing schedule and reschedules via PATCH', async () => {
    mockApiFetch.mockImplementation(((path: string) =>
      path.includes('/reminders')
        ? Promise.resolve({ reminders: [wireReminder] })
        : Promise.resolve(PRO_ENTITLEMENTS)) as never);
    renderModal();

    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
    fireEvent.click(screen.getByText('Edit'));
    // Edit shows the schedule options again (no implicit preselection).
    fireEvent.click(screen.getByText('Tomorrow'));
    fireEvent.click(screen.getByText('Update reminder'));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/reminders/rem_1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const patchCall = mockApiFetch.mock.calls.find(([p]) => p === '/reminders/rem_1');
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse((patchCall as unknown as [string, { body: string }])[1].body);
    expect(patchBody).toEqual({ remindAt: expect.any(String) });
  });

  it('cancels an existing reminder through the inline confirmation', async () => {
    mockApiFetch.mockImplementation(((path: string, init?: { method?: string }) =>
      path.includes('/reminders') && init?.method === 'DELETE'
        ? Promise.resolve(undefined)
        : path.includes('/reminders')
          ? Promise.resolve({ reminders: [wireReminder] })
          : Promise.resolve(PRO_ENTITLEMENTS)) as never);
    renderModal();

    fireEvent.click(await screen.findByText('Cancel reminder'));
    await waitFor(() => expect(screen.getByText('Keep reminder')).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel reminder'));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/reminders/rem_1', { method: 'DELETE' }));
  });
});
