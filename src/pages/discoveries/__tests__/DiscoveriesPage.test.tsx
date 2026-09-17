import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoveriesPage from '../DiscoveriesPage';
import { apiFetch } from '../../../lib/apiClient';
import { EntitlementContext } from '../../../contexts/entitlementContext';
import type { EntitlementContextValue } from '../../../contexts/entitlementContext';
import { ToastProvider } from '../../../contexts/ToastProvider';
import type { DiscoveriesWire } from '../../../lib/discoveryWire';
import type { Entitlements } from '../../../types';
import { LocaleProvider } from '../../../contexts/LocaleProvider';
import i18n from '../../../i18n';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const HOUR = 3_600_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * HOUR).toISOString();

type WireRow = DiscoveriesWire['discoveries'][number];

const wireRow = (overrides: Partial<WireRow> = {}): WireRow => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'Netflix renews at $15.49',
  description: 'Standard plan, monthly renewal.',
  company: 'Netflix',
  amount: 15.49,
  currency: 'USD',
  eventDate: daysFromNow(3),
  priority: 'high',
  status: 'active',
  isLocked: false,
  availableActions: ['review_subscription', 'dismiss'],
  confidence: 0.9,
  createdAt: daysFromNow(-1),
  ...overrides,
});

const wireResponse = (rows: WireRow[], lockedCount = 0): DiscoveriesWire => ({
  discoveries: rows,
  total: rows.length + lockedCount,
  lockedCount,
  pagination: { limit: 100, offset: 0 },
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
  decrementChatQuestions: vi.fn(),
});

const renderPage = ({ plan = 'pro' }: { plan?: 'free' | 'pro' } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementContext.Provider value={entitlementValue(plan)}>
            <ToastProvider>
              <MemoryRouter initialEntries={['/app/discoveries']}>
                <Routes>
                  <Route path="/app/discoveries" element={<DiscoveriesPage />} />
                  <Route path="/app/discoveries/:id" element={<div>probe:detail</div>} />
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

/** Standard fixture: two high-priority rows (featured) + one medium row. */
const standardRows = (): WireRow[] => [
  wireRow(),
  wireRow({ id: 'disc-2', company: 'Spotify', title: 'Spotify Premium renews', priority: 'high' }),
  wireRow({ id: 'disc-3', company: 'Hulu', title: 'Hulu bill changed', type: 'change', priority: 'medium' }),
];

describe('DiscoveriesPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('renders stats, featured cards, and the full list from GET /discoveries', async () => {
    mockApiFetch.mockResolvedValue(wireResponse(standardRows()));
    renderPage();

    expect(await screen.findByTestId('featured-section')).toBeTruthy();
    // Featured: only high-importance unlocked rows (2 of 3).
    expect(screen.getAllByTestId('discovery-card')).toHaveLength(2);
    // The full list renders every row.
    expect(screen.getAllByTestId('discovery-list-item')).toHaveLength(3);
  });

  it('renders the empty state when the backend returns no rows', async () => {
    mockApiFetch.mockResolvedValue(wireResponse([]));
    renderPage();

    expect(await screen.findByText('Nothing needs your attention right now')).toBeTruthy();
    expect(screen.queryByTestId('discoveries-list')).toBeFalsy();
  });

  it('renders the error state with a working retry', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(wireResponse(standardRows()));
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText("Couldn't load your discoveries")).toBeTruthy();

    await waitFor(async () => {
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    });
    expect(await screen.findByTestId('discoveries-page')).toBeTruthy();
  });

  it('renders skeletons while loading', () => {
    mockApiFetch.mockImplementation(() => new Promise<DiscoveriesWire>(() => {}));
    renderPage();

    expect(screen.getByTestId('discoveries-page-loading')).toBeTruthy();
    expect(screen.getAllByTestId('skeleton-line').length).toBeGreaterThan(0);
  });

  it('shows the locked section with the backend lockedCount for a Free user', async () => {
    mockApiFetch.mockResolvedValue(wireResponse(standardRows(), 7));
    renderPage({ plan: 'free' });

    const locked = await screen.findByTestId('locked-section');
    expect(locked).toBeTruthy();
    expect(screen.getByTestId('locked-count').textContent).toContain('7 more discoveries');
  });

  it('hides the locked section when lockedCount is 0', async () => {
    mockApiFetch.mockResolvedValue(wireResponse(standardRows(), 0));
    renderPage({ plan: 'pro' });

    await screen.findByTestId('discoveries-page');
    expect(screen.queryByTestId('locked-section')).toBeFalsy();
  });

  it('filters rows with the Ending Soon tab (client-side over the fetched window)', async () => {
    mockApiFetch.mockResolvedValue(
      wireResponse([
        ...standardRows(),
        wireRow({ id: 'disc-4', company: 'Columbia', title: 'Far-out renewal', eventDate: daysFromNow(30) }),
      ]),
    );
    renderPage();

    await screen.findByTestId('discoveries-list');
    await userEvent.click(screen.getByTestId('filter-tab-ending-soon'));

    const rows = screen.getAllByTestId('discovery-list-item');
    expect(rows).toHaveLength(3); // standard rows all end within days; disc-4 does not
  });

  it('filters rows with the New tab by createdAt recency', async () => {
    mockApiFetch.mockResolvedValue(
      wireResponse([
        wireRow(),
        wireRow({
          id: 'disc-old',
          company: 'Old',
          title: 'Old row',
          createdAt: daysFromNow(-30),
        }),
      ]),
    );
    renderPage();

    await screen.findByTestId('discoveries-list');
    await userEvent.click(screen.getByTestId('filter-tab-new'));

    expect(screen.getAllByTestId('discovery-list-item')).toHaveLength(1);
  });

  it('search filters rows after the 300ms debounce', async () => {
    mockApiFetch.mockResolvedValue(wireResponse(standardRows()));
    renderPage();

    await screen.findByTestId('discoveries-list');
    await userEvent.type(screen.getByTestId('discoveries-search'), 'spotify');

    // Only the Spotify row remains once the debounce settles.
    await waitFor(
      () => {
        const rows = screen.getAllByTestId('discovery-list-item');
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain('Spotify');
      },
      { timeout: 1500 },
    );
  });

  it('shows the saved-tab unavailable state (backend has no saved concept)', async () => {
    mockApiFetch.mockResolvedValue(wireResponse(standardRows()));
    renderPage();

    await screen.findByTestId('discoveries-list');
    await userEvent.click(screen.getByTestId('filter-tab-saved'));

    expect(screen.getByText("Saving isn't available yet")).toBeTruthy();
  });

  it('dismisses optimistically: PATCH with an empty body, row removed immediately', async () => {
    mockApiFetch
      .mockResolvedValueOnce(wireResponse(standardRows())) // initial GET
      .mockResolvedValue(wireResponse(standardRows().filter((r) => r.id !== 'disc-1'))); // post-dismiss refetch
    renderPage();

    const listItems = await screen.findAllByTestId('discovery-list-item');
    expect(listItems).toHaveLength(3);

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
    await userEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByTestId('discovery-list-item')).toHaveLength(2);
    });
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/dismiss', { method: 'PATCH' });
  });

  it('restores the row when the dismiss request fails', async () => {
    mockApiFetch
      .mockResolvedValueOnce(wireResponse(standardRows())) // initial GET
      .mockRejectedValueOnce(new Error('500')) // dismiss fails
      .mockResolvedValue(wireResponse(standardRows())); // revert refetch
    renderPage();

    const listItems = await screen.findAllByTestId('discovery-list-item');
    expect(listItems).toHaveLength(3);

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
    await userEvent.click(dismissButtons[0]);

    // After the failed PATCH + refetch, the row is back.
    await waitFor(() => {
      expect(screen.getAllByTestId('discovery-list-item')).toHaveLength(3);
    });
  });

  it('opens the RequiresPro upgrade path when a Free user clicks Remind me', async () => {
    mockApiFetch.mockResolvedValue(
      wireResponse([wireRow({ availableActions: ['remind', 'dismiss'] })]),
    );
    renderPage({ plan: 'free' });

    await screen.findByTestId('discoveries-list');
    await userEvent.click(screen.getAllByRole('button', { name: /remind me/i })[0]);

    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
  });

  it('opens the reminder scheduling modal for a Pro user', async () => {
    mockApiFetch.mockResolvedValue(
      wireResponse([wireRow({ availableActions: ['remind', 'dismiss'] })]),
    );
    renderPage({ plan: 'pro' });

    await screen.findByTestId('discoveries-list');
    await userEvent.click(screen.getAllByRole('button', { name: /remind me/i })[0]);

    // FE-020: the modal replaces the old "not yet" toast; no paywall for Pro.
    expect(screen.queryByTestId('upgrade-prompt')).toBeFalsy();
    expect(await screen.findByTestId('reminder-modal')).toBeTruthy();
  });
});
