import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ShieldCheck, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/data-table';
import { UserStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { BulkConfirmDialog } from '@/components/ui/bulk-confirm-dialog';
import { Can } from '@/components/auth/can';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';
import { formatNumber } from '@/lib/utils';

interface Row {
  id: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  locale: string;
  driverId: string | null;
  tripCount: number;
  createdAt: string;
}

type BulkAction = 'suspend' | 'activate' | 'delete';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', { search }],
    queryFn: () => usersApi.list({ search: search || undefined, limit: 100 }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: BulkAction; reason: string }) => {
      const ids = selected;
      if (action === 'suspend') return usersApi.bulkSuspend(ids, reason);
      if (action === 'activate') return usersApi.bulkActivate(ids, reason);
      return usersApi.bulkDelete(ids, reason);
    },
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => {
      const er = readApiError(e);
      toast.error(er.code, er.message);
    },
  });

  const columns: Column<Row>[] = [
    { key: 'phone', header: t('common.phone'), cell: (r) => <span className="font-mono text-xs">{r.phone}</span>, sortValue: (r) => r.phone },
    { key: 'email', header: t('common.email'), cell: (r) => r.email ? <span className="break-all">{r.email}</span> : <span className="text-muted-foreground">—</span>, sortValue: (r) => r.email ?? '' },
    { key: 'status', header: t('common.status'), cell: (r) => <UserStatusBadge status={r.status} />, sortValue: (r) => r.status },
    { key: 'driver', header: t('users.driver'), cell: (r) => (r.driverId ? <Badge variant="success">{t('common.yes')}</Badge> : <span className="text-muted-foreground">—</span>) },
    { key: 'trips', header: t('users.tripsCount'), align: 'right', cell: (r) => formatNumber(r.tripCount), sortValue: (r) => r.tripCount },
    {
      key: 'createdAt',
      header: t('users.joined'),
      cell: (r) => <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>,
      sortValue: (r) => r.createdAt,
    },
  ];

  const confirmLabels: Record<BulkAction, string> = {
    suspend: t('users.suspend'),
    activate: t('users.activate'),
    delete: t('common.delete'),
  };
  const confirmVariants: Record<BulkAction, 'warning' | 'success' | 'danger'> = {
    suspend: 'warning',
    activate: 'success',
    delete: 'danger',
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-8"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/users/${r.id}`)}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="users.activate">
          <Button size="sm" variant="success" onClick={() => setPendingAction('activate')}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('users.activate')}
          </Button>
        </Can>
        <Can permission="users.suspend">
          <Button size="sm" variant="warning" onClick={() => setPendingAction('suspend')}>
            <Ban className="h-3.5 w-3.5" />
            {t('users.suspend')}
          </Button>
        </Can>
        <Can permission="users.delete">
          <Button size="sm" variant="danger" onClick={() => setPendingAction('delete')}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={pendingAction ? confirmLabels[pendingAction] : ''}
        confirmVariant={pendingAction ? confirmVariants[pendingAction] : 'default'}
        loading={bulkMutation.isPending}
        onConfirm={(reason) => pendingAction && bulkMutation.mutate({ action: pendingAction, reason })}
      />
    </div>
  );
}
