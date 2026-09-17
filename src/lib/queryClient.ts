import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query singleton — import this in the provider (src/main.tsx)
 * and wherever invalidation is needed. Kept minimal per FE-001:
 * no custom retry logic beyond `retry: 1`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})
