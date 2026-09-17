import type { QueryClientConfig } from '@tanstack/react-query';
import { shouldRetry, getRetryAfterMs } from '@/features/platform-api/retry';

export const adminQueryConfiguration: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: (count, error) => shouldRetry(error, count),
      retryDelay: (attempt, error) => getRetryAfterMs(error, attempt),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
};
