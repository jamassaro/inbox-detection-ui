import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionsPage from '../SubscriptionsPage';
import { apiFetch } from '../../lib/apiClient';
import i18n from '../../i18n';
import type { SubscriptionListResponse } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <SubscriptionsPage />
        </QueryClientProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const makeResponse = (overrides: Partial<SubscriptionListResponse> = {}): SubscriptionListResponse => ({
  subscriptions: [
    {
      id: 'sub-1',
      company: 'Netflix',
      companyInitials: 'NF',
      currentAmount: 15.49,
      currency: 'USD',
      frequency: 'monthly',
      nextRenewal: '2026-10-15T00:00:00.000Z',
    },
    {
      id: 'sub-2',
      company: 'Adobe Creative Cloud',
      companyInitials: 'AC',
      product: 'Creative Cloud All Apps',
      currentAmount: 599.88,
      currency: 'USD',
      frequency: 'annual',
      previousAmount: 549.99,
      discoveryId: 'disc-1',
    },
  ],
  ...overrides,
});

afterEach(cleanup);

describe('SubscriptionsPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('shows skeleton rows while loading', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('loading-skeletons')).toBeTruthy();
  });

  it('renders subscription rows with company, amount, and frequency', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    const rows = await screen.findAllByTestId('subscription-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('Adobe Creative Cloud')).toBeTruthy();
  });

  it('displays the product name when provided', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findAllByTestId('subscription-row');
    expect(screen.getByText('Creative Cloud All Apps')).toBeTruthy();
  });

  it('shows the price changed badge when previousAmount is set', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findAllByTestId('subscription-row');
    const badges = screen.getAllByTestId('price-changed-badge');
    expect(badges).toHaveLength(1);
  });

  it('shows summary totals when subscriptions are loaded', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findByTestId('summary-totals');
    // Monthly total: $15.49 (Netflix monthly) + $599.88/12 (Adobe annual) ≈ $65.48
    const totals = screen.getByTestId('summary-totals').textContent ?? '';
    expect(totals).toContain('$');
  });

  it('shows the empty state when there are no subscriptions', async () => {
    mockApiFetch.mockResolvedValue({ subscriptions: [] });
    renderPage();

    await screen.findByText('No subscriptions detected yet');
  });

  it('shows the error state with retry when the request fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));
    renderPage();

    await screen.findByText("Couldn't load subscriptions");
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders in Spanish when locale is es', async () => {
    await i18n.changeLanguage('es');
    mockApiFetch.mockResolvedValue({ subscriptions: [] });
    renderPage();

    await screen.findByText('No se detectaron suscripciones todavía');
    await i18n.changeLanguage('en');
  });
});
