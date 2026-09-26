import { clearWellness } from '@/lib/wellness/wellness-store';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/stores/auth.store';
import { browserQueryStorage, createAccountQueryCache } from './account-query-cache';
import { clearOcrCapture } from '@/lib/ocr/ocr-capture-store';
import { clearRecordDrafts } from '@/lib/record-drafts/record-draft-store';

export function QueryProvider({ children }: PropsWithChildren) {
  const accountId = useAuth((state) => state.user?.id ?? null);
  const previousAccount = useRef(accountId);
  useEffect(() => {
    const previous = previousAccount.current;
    previousAccount.current = accountId;
    if (previous && previous !== accountId) {
      try { localStorage.removeItem('ehsbha.wellness'); } catch { /* Storage may be unavailable during sign-out. */ }
      void clearWellness(previous).catch(() => {});
      void clearOcrCapture(previous).catch(() => {});
      void clearRecordDrafts(previous).catch(() => {});
    }
  }, [accountId]);
  return <AccountQueries key={accountId ?? 'guest'} accountId={accountId}>{children}</AccountQueries>;
}

function AccountQueries({ children, accountId }: PropsWithChildren<{ accountId: string | null }>) {
  const [{ client, persister, persistOptions }] = useState(() => createAccountQueryCache(accountId, browserQueryStorage()));
  useEffect(() => () => {
    client.clear();
    void persister.removeClient();
  }, [client, persister]);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
