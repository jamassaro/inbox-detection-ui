import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { useSubscriptions } from '../useSubscriptions';
import type { SubscriptionListResponse } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockResponse: SubscriptionListResponse = {
  subscriptions: [
    {
      id: 'sub-1',
      company: 'Netflix',
      plan: 'Premium',
      currentAmount: 15.49,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: '2026-10-01T00:00:00.000Z',
      monthlyEquivalent: 15.49,
      annualCost: 185.88,
      status: 'active',
    },
    {
      id: 'sub-2',
      company: 'Adobe',
      plan: null,
      currentAmount: 599.88,
      currency: 'USD',
      billingCycle: 'yearly',
      nextBillingDate: null,
      monthlyEquivalent: 49.99,
      annualCost: 599.88,
      status: 'active',
    },
  ],
  summary: { total: 2, monthlyTotal: 65.48, annualTotal: 785.76 },
};

afterEach(cleanup);

describe('useSubscriptions', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('returns loading state initially', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSubscriptions(), { wrapper: makeWrapper() });
    expect(result.current.isPending).toBe(true);
  });

  it('fetches from GET /subscriptions and returns the list', async () => {
    mockApiFetch.mockResolvedValue(mockResponse);
    const { result } = renderHook(() => useSubscriptions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/subscriptions/records');
    expect(result.current.data?.subscriptions).toHaveLength(2);
    expect(result.current.data?.subscriptions[0].company).toBe('Netflix');
  });

  it('exposes error state when the request fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSubscriptions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
