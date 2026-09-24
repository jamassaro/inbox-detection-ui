import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RemindersWidget from '../RemindersWidget';
import { apiFetch } from '../../lib/apiClient';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import type { ReminderWire } from '../../hooks/useReminders';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireReminder = (overrides: Partial<ReminderWire> = {}): ReminderWire => ({
  id: 'rem_1',
  userId: 'usr_1',
  discoveryId: 'disc_1',
  title: 'Netflix renews at $15.49',
  description: null,
  remindAt: '2026-10-01T09:00:00.000Z',
  status: 'pending',
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

/** Renders the destination pathname so navigation assertions can read it. */
const PathProbe = () => {
  const { pathname } = useLocation();
  return <div>probe:{pathname}</div>;
};

const renderWidget = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <LocaleProvider>
            <MemoryRouter initialEntries={['/app/dashboard']}>
              <Routes>
                <Route path="/app/*" element={<><RemindersWidget /><PathProbe /></>} />
              </Routes>
            </MemoryRouter>
          </LocaleProvider>
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

const stubReminders = (reminders: ReminderWire[], { onDelete }: { onDelete?: (id: string) => void } = {}) => {
  mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/reminders') return { reminders };
    if (path.startsWith('/reminders/') && options?.method === 'DELETE') {
      onDelete?.(path.split('/')[2]!);
      return undefined;
    }
    throw new Error(`unexpected apiFetch: ${path} ${options?.method ?? 'GET'}`);
  });
};

describe('RemindersWidget', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('is collapsed by default with no badge when there are no upcoming reminders', async () => {
    stubReminders([]);
    renderWidget();

    expect(await screen.findByTestId('reminders-widget-toggle')).toBeTruthy();
    expect(screen.queryByTestId('reminders-widget-panel')).toBeNull();
    expect(screen.queryByTestId('reminders-widget-badge')).toBeNull();
  });

  it('shows a badge with the count of upcoming (pending) reminders', async () => {
    stubReminders([wireReminder(), wireReminder({ id: 'rem_2', status: 'sent' })]);
    renderWidget();

    const badge = await screen.findByTestId('reminders-widget-badge');
    expect(badge.textContent).toBe('1');
  });

  it('opens the panel on click and closes it again on a second click', async () => {
    stubReminders([wireReminder()]);
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    expect(await screen.findByTestId('reminders-widget-panel')).toBeTruthy();

    await user.click(screen.getByTestId('reminders-widget-toggle'));
    expect(screen.queryByTestId('reminders-widget-panel')).toBeNull();
  });

  it('shows upcoming reminders with title, date, and a link to the discovery', async () => {
    stubReminders([wireReminder()]);
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));

    const row = await screen.findByTestId('reminder-row');
    expect(row.textContent).toContain('Netflix renews at $15.49');
    expect(row.textContent).toContain('October 1, 2026');
    const link = screen.getByRole('link', { name: 'View discovery' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/app/discoveries/disc_1');
  });

  it('navigates and closes the panel when the discovery link is clicked', async () => {
    stubReminders([wireReminder()]);
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    await user.click(await screen.findByRole('link', { name: 'View discovery' }));

    expect(await screen.findByText('probe:/app/discoveries/disc_1')).toBeTruthy();
    expect(screen.queryByTestId('reminders-widget-panel')).toBeNull();
  });

  it('shows sent/cancelled/failed reminders under History, most recent first, with status badges', async () => {
    stubReminders([
      wireReminder({ id: 'rem_sent', status: 'sent', remindAt: '2026-09-01T09:00:00.000Z' }),
      wireReminder({ id: 'rem_cancelled', status: 'cancelled', remindAt: '2026-09-15T09:00:00.000Z' }),
    ]);
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    await user.click(await screen.findByTestId('reminders-tab-history'));

    const rows = screen.getAllByTestId('reminder-row');
    expect(rows).toHaveLength(2);
    // Server sorts remindAt ascending; History reverses to most-recent-first.
    expect(rows[0]!.textContent).toContain('September 15, 2026');
    expect(screen.getAllByTestId('reminder-status-badge')[0]!.textContent).toBe('Cancelled');
    expect(rows[1]!.textContent).toContain('September 1, 2026');
    expect(screen.queryByTestId('reminder-cancel')).toBeNull();
  });

  it('shows the empty state per tab', async () => {
    stubReminders([]);
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    expect(await screen.findByText('No upcoming reminders.')).toBeTruthy();

    await user.click(screen.getByTestId('reminders-tab-history'));
    expect(await screen.findByText('No reminder history yet.')).toBeTruthy();
  });

  it('cancels a pending reminder after confirmation, and shows a success toast', async () => {
    let deletedId: string | null = null;
    stubReminders(
      [wireReminder()],
      { onDelete: (id) => { deletedId = id; } },
    );
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    await user.click(await screen.findByTestId('reminder-cancel'));

    // Confirmation dialog gates the destructive call — scope to the dialog,
    // since its confirm button shares the same label as the row's own.
    expect(deletedId).toBeNull();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reminder' }));

    await waitFor(() => expect(deletedId).toBe('rem_1'));
    expect(await screen.findByText('Reminder cancelled')).toBeTruthy();
  });

  it('renders an error state with retry when the fetch fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('reminders-widget-toggle'));
    expect(await screen.findByText("Couldn't load reminders.")).toBeTruthy();
  });
});
