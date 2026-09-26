import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { MaintenanceView } from '@ehsbha/shared-types';
import { Plus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { MaintenanceApi, type MaintenanceRecord } from '@/lib/api/endpoints';
import { formatDate, formatKm, formatMoney } from '@/lib/format';
import { useVehicleSelector, vehicleLabel } from '@/hooks/use-vehicle-selector';
import { MAINTENANCE_DATE_FORMAT, MAINTENANCE_INVALIDATIONS, MAINTENANCE_VIEWS, MaintenanceDialogMode } from './maintenance.control';
import { MaintenanceRecordDialog, ResumeMaintenanceDraft } from './maintenance-record-dialog';
import { MaintenanceStatusDialog } from './maintenance-status-dialog';
import { MaintenanceHistory } from './maintenance-history';
import { MaintenanceRisk } from './maintenance-risk';

export function MaintenancePage() {
  const { t, locale } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const queryClient = useQueryClient();
  const vehicleQuery = useVehicleSelector();
  const { vehicles, selected, selectedId, setSelectedId } = vehicleQuery;
  const [view, setView] = useState(MaintenanceView.Active);
  const [dialog, setDialog] = useState<MaintenanceDialogMode | null>(null);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [statusRecord, setStatusRecord] = useState<MaintenanceRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<MaintenanceRecord | null>(null);
  const records = useInfiniteQuery({ queryKey: ['maintenance', 'records', selectedId, view],
    queryFn: ({ pageParam }) => MaintenanceApi.records(selectedId, { view, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '', getNextPageParam: (page) => page.nextCursor, enabled: !!selectedId });
  const rows = (records.data?.pages.flatMap((page) => page.items) ?? []).map((row) => ({ ...row,
    label: row.maintenanceItem ? itemLabel(row.maintenanceItem) : t('maintenance.record') }));
  function saved() {
    setDialog(null); setEditing(null); setStatusRecord(null);
    for (const key of MAINTENANCE_INVALIDATIONS) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  function add() { setEditing(null); setDialog(MaintenanceDialogMode.Create); }
  function edit(record: MaintenanceRecord) { setEditing(record); setDialog(MaintenanceDialogMode.Edit); }
  function close() { setDialog(null); setEditing(null); }
  return <div className="space-y-6 animate-fade-in">
    <PageHeader title={t('maintenance.title')} subtitle={t('maintenance.subtitle')}
      actions={<Button className="min-h-11 gap-2" disabled={!selected} onClick={add}><Plus className="h-4 w-4" aria-hidden />{t('maintenance.addRecord')}</Button>} />
    {dialog === null ? <RecordDraftList kind={RecordDraftKind.Maintenance} render={(draft, close) => <ResumeMaintenanceDraft draft={draft} onClose={close} onSaved={() => { close(); saved(); }} />} /> : null}
    {vehicleQuery.isLoading ? <p role="status">{t('common.loading')}</p> : vehicleQuery.error ? <div role="alert"><p>{t('maintenance.vehiclesFailed')}</p>
      <Button variant="outline" onClick={() => void vehicleQuery.refetch()}>{t('common.retry')}</Button></div> : !vehicles.length ? <EmptyState Icon={Wrench} title={t('maintenance.noVehicles')}
        action={<Button asChild><Link to="/settings">{t('nav.settings')}</Link></Button>} /> : <>
      <div className="space-y-1.5"><Label htmlFor="maintenance-vehicle">{t('recordDrafts.vehicle')}</Label>
        <Select id="maintenance-vehicle" className="min-h-11" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle, t(`settings.vehicleType.${vehicle.type}`))}</option>)}
        </Select></div>
      <Card><CardHeader><CardTitle>{t('maintenance.historyTitle')}</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('maintenance.paymentBasis')}</p>
        <div className="flex flex-wrap gap-2">{MAINTENANCE_VIEWS.map((choice) => <Button key={choice} className="min-h-11" variant={choice === view ? 'default' : 'outline'} aria-pressed={choice === view} onClick={() => setView(choice)}>{t(`maintenance.view.${choice}`)}</Button>)}
          <Button className="min-h-11" variant="outline" loading={records.isRefetching} onClick={() => void records.refetch()}>{t('maintenance.refresh')}</Button></div>
        {records.isLoading ? <p role="status">{t('common.loading')}</p> : null}
        {records.isError ? <div role="alert"><p>{t('maintenance.recordsFailed')}</p><Button variant="outline" onClick={() => void records.refetch()}>{t('common.retry')}</Button></div> : null}
        {records.isSuccess && !rows.length ? <p>{t('maintenance.noRecords')}</p> : null}
        {rows.map((row) => <article key={row.id} className="space-y-3 rounded-xl border p-3" aria-label={row.label}>
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-medium">{row.label}</h3><p className="num-tabular font-semibold">{formatMoney(row.costPiastres, locale)}</p></div>
          <p className="text-sm">{formatDate(row.performedAt, locale, MAINTENANCE_DATE_FORMAT)} · {formatKm(row.odometerMeters, locale)}</p>
          {row.linkedExpenseId ? <p className="text-sm">{t('maintenance.link.linked')}</p> : null}
          {row.notes ? <p className="whitespace-pre-wrap break-words text-sm">{row.notes}</p> : null}
          <div className="flex flex-wrap gap-2">{!row.deletedAt ? <Button className="min-h-11" variant="outline" onClick={() => edit(row)}>{t('maintenance.edit')}</Button> : null}
            <Button className="min-h-11" variant="outline" onClick={() => setStatusRecord(row)}>{t(row.deletedAt ? 'maintenance.restore' : 'common.delete')}</Button>
            <Button className="min-h-11" variant="ghost" onClick={() => setHistoryRecord(row)}>{t('maintenance.history')}</Button></div>
        </article>)}
        {records.hasNextPage ? <Button className="min-h-11 w-full" variant="outline" loading={records.isFetchingNextPage} onClick={() => void records.fetchNextPage()}>{t('maintenance.loadMore')}</Button> : null}
      </CardContent></Card>
      {selectedId ? <MaintenanceRisk vehicleId={selectedId} /> : null}
    </>}
    {dialog !== null && selected ? <MaintenanceRecordDialog key={editing?.id ?? selected.id} record={editing} vehicle={selected} onClose={close} onSaved={saved} /> : null}
    {statusRecord ? <MaintenanceStatusDialog record={statusRecord} onClose={() => setStatusRecord(null)} onSaved={saved} /> : null}
    {historyRecord ? <MaintenanceHistory record={historyRecord} onClose={() => setHistoryRecord(null)} /> : null}
  </div>;
}
