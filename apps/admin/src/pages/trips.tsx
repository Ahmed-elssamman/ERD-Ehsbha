import { formatBusinessTimestamp } from '@/lib/utils';
import { useRef, useState } from 'react';
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
import type { TripVersionTarget } from '@ehsbha/shared-types';
import { TRIP_LIST_AMOUNTS, TRIP_ACTION_ERROR_CODES, TripBulkAction as BulkAction } from './trips.control';

interface Row {
  id: string;
  version: number;
  driverId: string;
  driverPhone: string;
  driverDisplayName: string;
  appName: string;
  appCode: string;
  areaName: string | null;
  startedAt: string;
  grossPiastres: number | null;
  earningsPiastres?: number | null;
  totalKmMeters: number;
  emptyKmMeters: number;
  deletedAt: string | null;
}


export function TripsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [targets, setTargets] = useState<TripVersionTarget[]>([]);
  const selected = targets.map((item) => item.id);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trips', { includeDeleted }],
    queryFn: () => tripsApi.list({ limit: 100, includeDeleted }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: BulkAction; reason: string }) => {
      const body = JSON.stringify({ action, reason, items: targets });
      if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
      return action === BulkAction.Delete ? tripsApi.bulkDelete(targets, reason, retry.current.key) : tripsApi.bulkRestore(targets, reason, retry.current.key);
    },
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setTargets([]);
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'trips'] });
    },
    onError: (e) => {
      const er = readApiError(e);
      if (er.code === 'TRIP_VERSION_CONFLICT') void qc.invalidateQueries({ queryKey: ['admin', 'trips'] });
      const message = TRIP_ACTION_ERROR_CODES.includes(er.code) ? t('errors.' + er.code) : er.message;
      toast.error(er.code, message);
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
      cell: (r) => <span className="text-muted-foreground">{formatBusinessTimestamp(r.startedAt, locale)}</span>,
      sortValue: (r) => r.startedAt,
    },
    ...TRIP_LIST_AMOUNTS.map<Column<Row>>((amount) => ({ key: amount.field, header: t(amount.label), align: 'right',
      cell: (row) => formatPiastres(row[amount.field] ?? null), sortValue: (row) => row[amount.field] ?? Number.NEGATIVE_INFINITY })),
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
        onSelectionChange={(ids) => {
          if (pendingAction) return;
          setTargets(ids.flatMap((id) => {
            const saved = targets.find((item) => item.id === id);
            const row = data?.items.find((item) => item.id === id);
            return saved ? [saved] : row ? [{ id, expectedVersion: row.version }] : [];
          }));
        }}
      />

      <BulkActionBar count={selected.length} onClear={() => setTargets([])}>
        <Can permission="trips.delete">
          <Button size="sm" variant="danger" onClick={() => setPendingAction(BulkAction.Delete)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
        <Can permission="trips.restore">
          <Button size="sm" variant="outline" onClick={() => setPendingAction(BulkAction.Restore)}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t('common.restore')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={pendingAction !== null}
        onClose={() => { if (!bulkMutation.isPending) setPendingAction(null); }}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={pendingAction === BulkAction.Delete ? t('common.delete') : t('common.restore')}
        confirmVariant={pendingAction === BulkAction.Delete ? 'danger' : 'default'}
        loading={bulkMutation.isPending}
        onConfirm={(reason) => pendingAction && bulkMutation.mutate({ action: pendingAction, reason })}
      />
    </div>
  );
}
