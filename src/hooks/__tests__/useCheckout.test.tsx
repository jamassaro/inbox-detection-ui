import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/apiClient';
import { ApiError } from '../../lib/apiError';
import { useCreateCheckout } from '../useCheckout';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Harness: a button that starts the mutation; the mutation's state is rendered for assertions. */
const CheckoutHarness = ({ plan }: { plan: 'monthly' | 'annual' }) => {
  const checkout = useCreateCheckout();
  return (
    <div>
      <button type="button" onClick={() => checkout.mutate(plan)}>
        start
      </button>
      <div data-testid="state">
        {checkout.isError
          ? `error: ${String(checkout.error?.message)}`
          : checkout.data
            ? 'done'
            : 'idle'}
      </div>
    </div>
  );
};

const renderHarness = (plan: 'monthly' | 'annual') => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutHarness plan={plan} />
    </QueryClientProvider>,
  );
};

describe('useCreateCheckout', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('posts the monthly price ID from env to /billing/checkout', async () => {
    vi.stubEnv('VITE_STRIPE_PRICE_MONTHLY_ID', 'price_monthly_1');
    mockApiFetch.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/m' });

    renderHarness('monthly');
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toBe('done');
    });
    expect(mockApiFetch).toHaveBeenCalledWith('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId: 'price_monthly_1' }),
    });
  });

  it('posts the annual price ID from env to /billing/checkout', async () => {
    vi.stubEnv('VITE_STRIPE_PRICE_ANNUAL_ID', 'price_annual_1');
    mockApiFetch.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/a' });

    renderHarness('annual');
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ priceId: 'price_annual_1' }),
      });
    });
  });

  it('fails without calling the API when the price ID is unconfigured', async () => {
    renderHarness('monthly');
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toContain('error:');
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('state').textContent).toContain('VITE_STRIPE_PRICE_MONTHLY_ID');
  });

  it('surfaces backend errors through the mutation error state', async () => {
    vi.stubEnv('VITE_STRIPE_PRICE_ANNUAL_ID', 'price_annual_1');
    mockApiFetch.mockRejectedValue(new ApiError(400, 'INVALID_PRICE', 'Invalid price'));

    renderHarness('annual');
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toContain('error:');
    });
  });
});
