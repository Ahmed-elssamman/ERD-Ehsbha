import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { useAdminAuth } from '@/stores/admin-auth.store';
import { adminQueryConfiguration } from './query-provider.control';

export function AdminQueryProvider({ children }: PropsWithChildren) {
  const accountId = useAdminAuth((state) => state.session?.admin.id ?? 'guest');
  return <AccountQueries key={accountId}>{children}</AccountQueries>;
}

function AccountQueries({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient(adminQueryConfiguration));
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
