import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvestigationResultsPage from '../InvestigationResultsPage';
import { sumPotentialValue } from '../../../lib/potentialValue';
import { apiFetch } from '../../../lib/apiClient';
import type { DiscoveryWire, InvestigationRecord } from '../../../hooks/useInvestigation';
import { LocaleProvider } from '../../../contexts/LocaleProvider';
import i18n from '../../../i18n';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireInvestigation = (overrides: Partial<InvestigationRecord> = {}): InvestigationRecord => ({
  id: 'inv-1',
  userId: 'usr_test',
  status: 'completed',
  emailsDiscovered: 320,
  emailsProcessed: 310,
  emailsClassified: 310,
  subscriptionsFound: 5,
  offersFound: 0,
  discoveriesCreated: 4,
  errorMessage: null,
  startedAt: '2026-09-17T11:00:00.000Z',
  completedAt: '2026-09-17T12:00:00.000Z',
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

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
  availableActions: ['review_subscription', 'dismiss'],
  confidence: 0.9,
  ...overrides,
});

const renderPage = ({ initialEntry = '/onboarding/results' }: { initialEntry?: string } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/onboarding/results" element={<InvestigationResultsPage />} />
              <Route path="/app/discoveries" element={<div>probe:/app/discoveries</div>} />
              <Route path="/upgrade" element={<div>probe:/upgrade</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>,
  );
};

describe('InvestigationResultsPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('renders the summary block and real discovery cards from GET /discoveries', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/investigation/')) {
        return Promise.resolve(wireInvestigation());
      }
      return Promise.resolve({
        discoveries: [
          wireDiscovery(),
          wireDiscovery({ id: 'disc-2', type: 'change', title: 'Spotify went up', company: 'Spotify', amount: 10.99 }),
        ],
        total: 4,
        lockedCount: 0,
        pagination: { total: 4, limit: 5, offset: 0 },
      });
    });

    renderPage({ initialEntry: '/onboarding/results?investigationId=inv-1' });

    // Real cards only render once both queries have resolved — anchor on data.
    expect(await screen.findByText('Netflix renews at $15.49')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your first discoveries' })).toBeTruthy();
    // Summary stats — real numbers, formatted (potential value = 15.49 + 10.99).
    expect(screen.getByText('310')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('$26.48')).toBeTruthy();
    expect(screen.getByText('Spotify went up')).toBeTruthy();
    // No locked rows → no locked card.
    expect(screen.queryByTestId('locked-discovery-card')).toBeNull();
  });

  it('shows the locked card and Unlock with Pro hand-off when locked discoveries exist', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/investigation/')) {
        return Promise.resolve(wireInvestigation());
      }
      return Promise.resolve({
        discoveries: [wireDiscovery()],
        total: 9,
        lockedCount: 8,
        pagination: { total: 9, limit: 5, offset: 0 },
      });
    });

    renderPage({ initialEntry: '/onboarding/results?investigationId=inv-1' });

    // LockedDiscoveryCard (FE-012) renders the real locked count.
    expect(await screen.findByTestId('locked-discovery-card')).toBeTruthy();
    expect(screen.getByTestId('locked-count').textContent).toMatch(/8 more discoveries/);
    // The upgrade link goes to /upgrade?from=investigation_results (FE-009).
    const unlockLinks = screen.getAllByRole('link', { name: 'Unlock with Pro' });
    expect(unlockLinks[0].getAttribute('href')).toBe('/upgrade?from=investigation_results');
    // The primary hand-off CTA is present.
    expect(screen.getByRole('link', { name: 'See all discoveries' }).getAttribute('href')).toBe('/app/discoveries');
  });

  it('omits the emails-analyzed stat when the investigation row is unknown', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/investigation/')) {
        return Promise.reject(new Error('no row'));
      }
      return Promise.resolve({
        discoveries: [wireDiscovery()],
        total: 1,
        lockedCount: 0,
        pagination: { total: 1, limit: 5, offset: 0 },
      });
    });

    renderPage();

    expect(await screen.findByText('Netflix renews at $15.49')).toBeTruthy();
    // Discoveries found is real; emails analyzed is NOT rendered as a fake 0.
    expect(screen.queryByText('Emails analyzed')).toBeNull();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders the empty state when the investigation found nothing', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/investigation/')) {
        return Promise.resolve(wireInvestigation({ emailsProcessed: 0 }));
      }
      return Promise.resolve({
        discoveries: [],
        total: 0,
        lockedCount: 0,
        pagination: { total: 0, limit: 5, offset: 0 },
      });
    });

    renderPage();

    expect(await screen.findByText('No discoveries yet')).toBeTruthy();
  });

  it('renders an error state with retry when /discoveries fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('network down'));

    renderPage();

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
  });
});

describe('sumPotentialValue', () => {
  it('sums real amounts per currency and skips rows without amounts', () => {
    const totals = sumPotentialValue([
      wireDiscovery({ amount: 15.49, currency: 'USD' }),
      wireDiscovery({ id: 'd2', amount: 10.01, currency: 'USD' }),
      wireDiscovery({ id: 'd3', amount: 5, currency: 'EUR' }),
      wireDiscovery({ id: 'd4', amount: null, currency: null }),
    ]);
    expect(totals).toEqual([
      { currency: 'EUR', amount: 5 },
      { currency: 'USD', amount: 25.5 },
    ]);
  });
});
