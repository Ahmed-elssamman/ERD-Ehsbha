import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Ban, ShieldCheck, Search } from 'lucide-react';
import { driversApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/data-table';
import { UserStatusBadge } from '@/components/ui/status-badge';
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
  displayName: string;
  phone: string;
  baseCity: string | null;
  userStatus: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  vehicleCount: number;
  tripCount: number;
  lastTripAt: string | null;
  joinedAt: string;
}

type BulkAction = 'suspend' | 'activate';

export function DriversPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'drivers', { search }],
    queryFn: () => driversApi.list({ search: search || undefined, limit: 100 }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: BulkAction; reason: string }) =>
      action === 'suspend' ? driversApi.bulkSuspend(selected, reason) : driversApi.bulkActivate(selected, reason),
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
    onError: (e) => {
      const er = readApiError(e);
      toast.error(er.code, er.message);
    },
  });

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (r) => (
        <div>
          <div className="font-medium">{r.displayName}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.phone}</div>
        </div>
      ),
      sortValue: (r) => r.displayName,
    },
    { key: 'baseCity', header: t('drivers.baseCity'), cell: (r) => r.baseCity ?? <span className="text-muted-foreground">—</span>, sortValue: (r) => r.baseCity ?? '' },
    { key: 'status', header: t('common.status'), cell: (r) => <UserStatusBadge status={r.userStatus} />, sortValue: (r) => r.userStatus },
    { key: 'vehicles', header: t('drivers.vehiclesCount'), align: 'right', cell: (r) => formatNumber(r.vehicleCount), sortValue: (r) => r.vehicleCount },
    { key: 'trips', header: t('users.tripsCount'), align: 'right', cell: (r) => formatNumber(r.tripCount), sortValue: (r) => r.tripCount },
    {
      key: 'lastTrip',
      header: t('drivers.lastTrip'),
      cell: (r) => r.lastTripAt
        ? <span className="text-muted-foreground">{new Date(r.lastTripAt).toLocaleDateString()}</span>
        : <span className="text-muted-foreground">{t('drivers.never')}</span>,
      sortValue: (r) => r.lastTripAt ?? '',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t('drivers.title')} description={t('drivers.subtitle')} />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" placeholder={t('drivers.searchHint')} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8" />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/drivers/${r.id}`)}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="drivers.activate">
          <Button size="sm" variant="success" onClick={() => setPendingAction('activate')}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('users.activate')}
          </Button>
        </Can>
        <Can permission="drivers.suspend">
          <Button size="sm" variant="warning" onClick={() => setPendingAction('suspend')}>
            <Ban className="h-3.5 w-3.5" />
            {t('users.suspend')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={pendingAction === 'suspend' ? t('users.suspend') : t('users.activate')}
        confirmVariant={pendingAction === 'suspend' ? 'warning' : 'success'}
        loading={bulkMutation.isPending}
        onConfirm={(reason) => pendingAction && bulkMutation.mutate({ action: pendingAction, reason })}
      />
    </div>
  );
}
