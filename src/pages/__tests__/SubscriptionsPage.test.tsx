import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      plan: null,
      currentAmount: 15.49,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: '2026-10-15T00:00:00.000Z',
      monthlyEquivalent: 15.49,
      annualCost: 185.88,
      status: 'active',
    },
    {
      id: 'sub-2',
      company: 'Adobe',
      plan: 'Creative Cloud All Apps',
      currentAmount: 599.88,
      currency: 'USD',
      domain: 'adobe.com',
      billingCycle: 'yearly',
      nextBillingDate: null,
      monthlyEquivalent: 49.99,
      annualCost: 599.88,
      status: 'active',
    },
  ],
  summary: { total: 2, monthlyTotal: 65.48, annualTotal: 785.76 },
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
    expect(screen.getByText('Adobe')).toBeTruthy();
  });

  it('displays the plan name when provided', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findAllByTestId('subscription-row');
    expect(screen.getByText('Creative Cloud All Apps')).toBeTruthy();
  });

  it('omits the plan line when the plan is null', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findAllByTestId('subscription-row');
    expect(screen.getAllByTestId('subscription-plan')).toHaveLength(1);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('labels each amount with its billing cycle', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    const rows = await screen.findAllByTestId('subscription-row');
    expect(rows[0].textContent).toContain('/ month');
    expect(rows[1].textContent).toContain('/ year');
  });

  it('shows summary totals when subscriptions are loaded', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    await screen.findByTestId('summary-totals');
    const totals = screen.getByTestId('summary-totals').textContent ?? '';
    expect(totals).toContain('$65.48');
    expect(totals).toContain('$785.76');
  });

  it('hides the totals when subscriptions use mixed currencies', async () => {
    const response = makeResponse();
    response.subscriptions[1].currency = 'EUR';
    mockApiFetch.mockResolvedValue(response);
    renderPage();

    await screen.findAllByTestId('subscription-row');
    expect(screen.queryByTestId('summary-totals')).toBeNull();
  });

  it('shows the empty state when there are no subscriptions', async () => {
    mockApiFetch.mockResolvedValue({ subscriptions: [], summary: { total: 0, monthlyTotal: 0, annualTotal: 0 } });
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
    mockApiFetch.mockResolvedValue({ subscriptions: [], summary: { total: 0, monthlyTotal: 0, annualTotal: 0 } });
    renderPage();

    await screen.findByText('No se detectaron suscripciones todavía');
    await i18n.changeLanguage('en');
  });

  it('expands a row inline to show details and collapses it again', async () => {
    mockApiFetch.mockResolvedValue(makeResponse());
    renderPage();

    const rows = await screen.findAllByTestId('subscription-row');
    expect(screen.queryByTestId('subscription-details')).toBeNull();

    const toggle = rows[1].querySelector('button')!;
    await userEvent.click(toggle);
    const details = screen.getByTestId('subscription-details');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(details.textContent).toContain('Annual cost');
    expect(details.textContent).toContain('$599.88');
    expect(details.textContent).toContain('Active');
    expect(screen.getByRole('link', { name: /adobe\.com/ }).getAttribute('href')).toBe('https://adobe.com');

    await userEvent.click(toggle);
    expect(screen.queryByTestId('subscription-details')).toBeNull();
  });

  it('omits detail items that are missing and never links an invalid domain', async () => {
    const response = makeResponse();
    response.subscriptions[1].domain = 'javascript:alert(1)';
    response.subscriptions[1].nextBillingDate = null;
    mockApiFetch.mockResolvedValue(response);
    renderPage();

    const rows = await screen.findAllByTestId('subscription-row');
    await userEvent.click(rows[1].querySelector('button')!);
    const details = screen.getByTestId('subscription-details');
    expect(details.textContent).not.toContain('Next billing');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
