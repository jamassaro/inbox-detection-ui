import { createContext } from 'react';
import type { Entitlements } from '../types';

/** TanStack Query cache key holding the signed-in user's entitlements. */
export const ENTITLEMENTS_QUERY_KEY = ['entitlements'] as const;

export interface EntitlementContextValue {
  /** Null while unauthenticated, loading, or when the fetch fails. */
  entitlements: Entitlements | null;
  isLoading: boolean;
  /** Re-fetches GET /user/entitlements and updates the shared cache (FE-017). */
  refresh: () => Promise<void>;
}

export const EntitlementContext = createContext<EntitlementContextValue | null>(null);
