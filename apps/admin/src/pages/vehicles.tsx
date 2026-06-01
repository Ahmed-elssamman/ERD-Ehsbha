import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { vehiclesApi } from '@/lib/api/endpoints';
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
import { formatNumber } from '@/lib/utils';

interface Row {
  id: string;
  type: 'CAR' | 'BIKE';
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string;
  isActive: boolean;
  odometerMeters: number;
  driverPhone: string;
  driverDisplayName: string;
  tripCount: number;
}

export function VehiclesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'vehicles'],
    queryFn: () => vehiclesApi.list({ limit: 100 }) as Promise<{ items: Row[] }>,
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (reason: string) => vehiclesApi.bulkDelete(selected, reason),
    onSuccess: (resp: { affected: number; skipped?: number }) => {
      const skippedMsg = resp.skipped ? ` · ${resp.skipped} ${t('vehicles.skipped')}` : '';
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}${skippedMsg}`);
      setSelected([]);
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  const columns: Column<Row>[] = [
    { key: 'type', header: t('vehicles.type'), cell: (r) => <Badge variant={r.type === 'CAR' ? 'default' : 'outline'}>{r.type}</Badge>, sortValue: (r) => r.type },
    {
      key: 'desc',
      header: t('vehicles.makeModelYear'),
      cell: (r) => [r.make, r.model, r.year].filter(Boolean).join(' ') || <span className="text-muted-foreground">{t('vehicles.unspecified')}</span>,
      sortValue: (r) => [r.make, r.model, r.year].filter(Boolean).join(' '),
    },
    { key: 'fuel', header: t('vehicles.fuel'), cell: (r) => <Badge variant="outline">{r.fuelType}</Badge>, sortValue: (r) => r.fuelType },
    {
      key: 'driver',
      header: t('drivers.title'),
      cell: (r) => (
        <div>
          <div className="font-medium">{r.driverDisplayName}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.driverPhone}</div>
        </div>
      ),
      sortValue: (r) => r.driverDisplayName,
    },
    { key: 'odo', header: t('vehicles.odometer'), align: 'right', cell: (r) => `${formatNumber(Math.round(r.odometerMeters / 1000))} km`, sortValue: (r) => r.odometerMeters },
    { key: 'trips', header: t('users.tripsCount'), align: 'right', cell: (r) => formatNumber(r.tripCount), sortValue: (r) => r.tripCount },
    { key: 'active', header: t('vehicles.active'), cell: (r) => r.isActive ? <Badge variant="success">{t('vehicles.on')}</Badge> : <Badge variant="muted">{t('vehicles.off')}</Badge>, sortValue: (r) => (r.isActive ? 1 : 0) },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t('vehicles.title')} description={t('vehicles.subtitle')} />
      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="vehicles.delete">
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('common.bulkConfirmTitle')}
        description={t('vehicles.deleteHint')}
        count={selected.length}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        loading={bulkDeleteMut.isPending}
        onConfirm={(reason) => bulkDeleteMut.mutate(reason)}
      />
    </div>
  );
}
