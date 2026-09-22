import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { SubscriptionListResponse } from '../types';

export const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions'] as const;

/** Fetches the user's detected subscriptions from `GET /subscriptions`. */
export function useSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: () => apiFetch<SubscriptionListResponse>('/subscriptions'),
  });
}
