import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw } from 'lucide-react';
import { tripsApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { BulkConfirmDialog } from '@/components/ui/bulk-confirm-dialog';
import { Can } from '@/components/auth/can';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';
import { formatNumber, formatPiastres } from '@/lib/utils';

interface Row {
  id: string;
  driverId: string;
  driverPhone: string;
  driverDisplayName: string;
  appName: string;
  appCode: string;
  areaName: string | null;
  startedAt: string;
  grossPiastres: number;
  totalKmMeters: number;
  emptyKmMeters: number;
  deletedAt: string | null;
}

type BulkAction = 'delete' | 'restore';

export function TripsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trips', { includeDeleted }],
    queryFn: () => tripsApi.list({ limit: 100, includeDeleted }) as Promise<{ items: Row[] }>,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: BulkAction; reason: string }) =>
      action === 'delete' ? tripsApi.bulkDelete(selected, reason) : tripsApi.bulkRestore(selected, reason),
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'trips'] });
    },
    onError: (e) => {
      const er = readApiError(e);
      toast.error(er.code, er.message);
    },
  });

  const columns: Column<Row>[] = [
    {
      key: 'driver',
      header: t('drivers.title'),
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.driverDisplayName}
            {r.deletedAt && <Badge variant="danger" className="ms-2">{t('common.deletedLabel')}</Badge>}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{r.driverPhone}</div>
        </div>
      ),
      sortValue: (r) => r.driverDisplayName,
    },
    { key: 'app', header: t('trips.app'), cell: (r) => <Badge variant="outline">{r.appName}</Badge>, sortValue: (r) => r.appName },
    { key: 'area', header: t('trips.area'), cell: (r) => r.areaName ?? <span className="text-muted-foreground">—</span>, sortValue: (r) => r.areaName ?? '' },
    {
      key: 'startedAt',
      header: t('trips.started'),
      cell: (r) => <span className="text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</span>,
      sortValue: (r) => r.startedAt,
    },
    { key: 'gross', header: t('trips.grossLabel'), align: 'right', cell: (r) => formatPiastres(r.grossPiastres), sortValue: (r) => r.grossPiastres },
    {
      key: 'distance',
      header: t('trips.distance'),
      align: 'right',
      cell: (r) => (
        <span>
          {formatNumber(Math.round(r.totalKmMeters / 1000))} km
          <span className="ms-1 text-xs text-muted-foreground">
            ({Math.round((r.emptyKmMeters / Math.max(1, r.totalKmMeters)) * 100)}% {t('trips.empty')})
          </span>
        </span>
      ),
      sortValue: (r) => r.totalKmMeters,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t('trips.title')}
        description={t('trips.subtitle')}
        actions={
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            {t('common.showDeleted')}
          </label>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/trips/${r.id}`)}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="trips.delete">
          <Button size="sm" variant="danger" onClick={() => setPendingAction('delete')}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
        <Can permission="trips.restore">
          <Button size="sm" variant="outline" onClick={() => setPendingAction('restore')}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t('common.restore')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={pendingAction === 'delete' ? t('common.delete') : t('common.restore')}
        confirmVariant={pendingAction === 'delete' ? 'danger' : 'default'}
        loading={bulkMutation.isPending}
        onConfirm={(reason) => pendingAction && bulkMutation.mutate({ action: pendingAction, reason })}
      />
    </div>
  );
}
