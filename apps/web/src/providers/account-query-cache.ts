import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { shouldRetry, getRetryAfterMs } from '@/features/platform-api/retry';
import { CONTRACT_VERSION } from '@ehsbha/api-contracts/core';

export function createAccountQueryCache(accountId: string | null, storage: Storage | null) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => shouldRetry(error, count),
        retryDelay: (attempt, error) => getRetryAfterMs(error, attempt),
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
  const persister = createSyncStoragePersister({
    storage: accountId ? storage : null,
    key: `ehsbha.rq.account.${accountId ?? 'guest'}`,
    throttleTime: 0,
  });
  return { client, persister, persistOptions: { persister, maxAge: 1000 * 60 * 60 * 24, buster: `${CONTRACT_VERSION}:reports-1` } };
}

export function browserQueryStorage(): Storage | null {
  try {
    window.localStorage.removeItem('ehsbha.rq');
    return window.localStorage;
  } catch {
    return null;
  }
}
