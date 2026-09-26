import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FuelView } from '@ehsbha/shared-types';
import { Fuel, Plus } from 'lucide-react';
import { FuelApi, type FuelEntry } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { recordMonthRange } from '@/lib/record-month-range';
import { useBusinessDate } from '@/hooks/use-business-date';
import { useVehicleSelector, vehicleLabel } from '@/hooks/use-vehicle-selector';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { FUEL_DATE_FORMAT, FUEL_INVALIDATIONS, FUEL_VIEWS } from './fuel.control';
import { FuelRecordDialog, ResumeFuelDraft } from './fuel-record-dialog';
import { FuelStatusDialog } from './fuel-status-dialog';
import { FuelHistory } from './fuel-history';
import { FuelEfficiency } from './fuel-efficiency';

export function FuelPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const vehicleQuery = useVehicleSelector();
  const { vehicles, selected, selectedId, setSelectedId } = vehicleQuery;
  const today = useBusinessDate();
  const [selectedMonth, setSelectedMonth] = useState('');
  const month = selectedMonth || today.slice(0, 7);
  const range = recordMonthRange(month);
  const [view, setView] = useState(FuelView.Active);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FuelEntry | null>(null);
  const [status, setStatus] = useState<FuelEntry | null>(null);
  const [history, setHistory] = useState<FuelEntry | null>(null);
  const [saved, setSaved] = useState(false);
  const list = useInfiniteQuery({ queryKey: ['fuel', 'list', selectedId, month, view], enabled: !!selectedId && range !== null,
    queryFn: ({ pageParam }) => FuelApi.list({ vehicleId: selectedId, from: range?.since, to: range?.until, view, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '', getNextPageParam: (page) => page.nextCursor });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const summary = list.data?.pages[0]?.summary;
  function closeEditor() { setCreating(false); setEditing(null); }
  function onSaved() {
    closeEditor(); setStatus(null); setSaved(true);
    for (const key of FUEL_INVALIDATIONS) void queryClient.invalidateQueries({ queryKey: [key] });
  }
  function changeMonth(value: string) { if (recordMonthRange(value)) { setSelectedMonth(value); setSaved(false); } }
  function add() { setCreating(true); setSaved(false); }
  function edit(record: FuelEntry) { setEditing(record); setSaved(false); }
  return <div className="space-y-5 animate-fade-in">
    <PageHeader title={t('fuel.title')} subtitle={t('fuel.subtitle')} actions={<Button className="min-h-11 gap-2" disabled={!selected} onClick={add}><Plus className="h-4 w-4" aria-hidden />{t('fuel.add')}</Button>} />
    {!creating && !editing ? <RecordDraftList kind={RecordDraftKind.Fuel} render={(draft, close) => <ResumeFuelDraft draft={draft} onClose={close} onSaved={() => { close(); onSaved(); }} />} /> : null}
    {vehicleQuery.isLoading ? <p role="status">{t('common.loading')}</p> : vehicleQuery.error ? <div role="alert"><p>{t('fuel.vehiclesFailed')}</p><Button variant="outline" onClick={() => void vehicleQuery.refetch()}>{t('common.retry')}</Button></div>
      : !vehicles.length ? <EmptyState Icon={Fuel} title={t('fuel.noVehicles')} action={<Button asChild><Link to="/settings">{t('nav.settings')}</Link></Button>} /> : <>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="fuel-vehicle">{t('fuel.vehicle')}</Label>
          <Select id="fuel-vehicle" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle, t(`settings.vehicleType.${vehicle.type}`))}</option>)}</Select></div>
          <div className="space-y-1"><Label htmlFor="fuel-month">{t('fuel.month')}</Label><Input id="fuel-month" type="month" min="1900-01" max="9998-12" value={month} onChange={(event) => changeMonth(event.target.value)} /></div></div>
        <div className="flex flex-wrap gap-2" aria-label={t('fuel.viewLabel')}>{FUEL_VIEWS.map((option) => <Button key={option} className="min-h-11" variant={view === option ? 'default' : 'outline'} aria-pressed={view === option} onClick={() => setView(option)}>{t(`fuel.view.${option}`)}</Button>)}</div>
        {saved ? <p role="status" className="text-sm text-success">{t('fuel.saved')}</p> : null}
        <p className="text-sm text-muted-foreground">{t('fuel.paymentBasis')}</p>
        {list.isLoading ? <p role="status">{t('common.loading')}</p> : list.isError ? <div role="alert"><p>{t('fuel.loadFailed')}</p><Button variant="outline" onClick={() => void list.refetch()}>{t('common.retry')}</Button></div> : <>
          {summary ? <div className="space-y-1 rounded-xl border p-4"><p className="text-sm">{t(view === FuelView.Active ? 'fuel.total' : 'fuel.archivedTotal')}</p>
            <p className="text-2xl font-semibold">{formatMoney(summary.totalPiastres, locale)}</p><p className="text-sm text-muted-foreground">{formatNumber(summary.recordCount, locale)} {t('fuel.records')}</p></div> : null}
          {!items.length ? <EmptyState Icon={Fuel} title={t('fuel.empty')} /> : <div className="space-y-3">{items.map((record) => <article key={record.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-lg font-semibold">{formatMoney(record.totalPiastres, locale)}</p>
              <p className="text-sm">{t(record.fuelKind ? `settings.fuelTypes.${record.fuelKind}` : 'fuel.kindUnknown')}</p></div>
            <p className="text-sm">{formatDate(record.dateTime, locale, FUEL_DATE_FORMAT)}</p>
            <p className="text-sm">{record.quantity === null ? t('fuel.quantityMissing') : `${formatNumber(record.quantity, locale, 3)} ${t(record.quantityUnit ? `fuel.unit.${record.quantityUnit}` : 'fuel.unitUnknown')}`}
              {record.odometerMeters === null ? '' : ` · ${formatKm(record.odometerMeters, locale, 3)} ${t('units.km')}`}</p>
            {record.linkedExpenseId ? <p className="text-sm"><Link className="underline" to="/expenses">{t('fuel.link.linked')}</Link></p> : null}
            {record.notes ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{record.notes}</p> : null}
            <div className="flex flex-wrap gap-2">{view === FuelView.Active ? <Button className="min-h-11" variant="outline" onClick={() => edit(record)}>{t('common.edit')}</Button> : null}
              <Button className="min-h-11" variant="outline" onClick={() => setStatus(record)}>{t(view === FuelView.Active ? 'common.delete' : 'fuel.restore')}</Button>
              <Button className="min-h-11" variant="ghost" onClick={() => setHistory(record)}>{t('fuel.history')}</Button></div>
          </article>)}</div>}
        </>}
        {list.hasNextPage ? <Button className="min-h-11" variant="outline" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('fuel.loadMore')}</Button> : null}
        {range && selectedId && view === FuelView.Active ? <FuelEfficiency vehicleId={selectedId} from={range.since} to={range.until} /> : null}
      </>}
    {(creating || editing) && selected ? <FuelRecordDialog key={editing?.id ?? selected.id} record={editing} vehicle={selected} onClose={closeEditor} onSaved={onSaved} /> : null}
    {status ? <FuelStatusDialog record={status} onClose={() => setStatus(null)} onSaved={onSaved} /> : null}
    {history ? <FuelHistory record={history} onClose={() => setHistory(null)} /> : null}
  </div>;
}
