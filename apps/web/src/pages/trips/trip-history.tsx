import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { tripSnapshotSchema } from '@ehsbha/api-contracts';
import { TripsApi, VehiclesApi, AppsApi, AreasApi, type TripItem } from '@/lib/api/endpoints';
import { OCR_PAYMENT_OPTIONS } from '@/components/ocr/ocr-review.control';
import { useI18n } from '@/i18n';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TRIP_HISTORY_AMOUNTS, TRIP_HISTORY_DATE_FORMAT, type TripHistoryLabels } from './trip-history.control';

interface Props { record: TripItem; onClose: () => void }
export function TripHistory({ record, onClose }: Props) {
  const { t, locale } = useI18n();
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const apps = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine });
  const areas = useQuery({ queryKey: ['areas'], queryFn: AreasApi.list });
  const labels: TripHistoryLabels = {
    vehicles: new Map((vehicles.data ?? []).map((vehicle) => [vehicle.id, [vehicle.make, vehicle.model, vehicle.year].filter((part) => part != null).join(' ') || t(`settings.vehicleType.${vehicle.type}`)])),
    apps: new Map((apps.data ?? []).map((app) => [app.id, app.customName ?? app.appSource?.name ?? app.id])),
    areas: new Map((areas.data ?? []).map((area) => [area.id, area.name])),
  };
  const query = useInfiniteQuery({ queryKey: ['trip-history', record.id], initialPageParam: '',
    queryFn: ({ pageParam }) => TripsApi.history(record.id, pageParam), getNextPageParam: (page) => page.nextCursor });
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <Dialog open onClose={onClose} title={t('trips.history')}>
    <div className="space-y-4"><p className="text-sm text-muted-foreground">{t('trips.historyHint')}</p>
      {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {query.isError ? <div role="alert"><p>{t('trips.historyFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
      {query.isSuccess && !entries.length ? <p>{t('trips.noHistory')}</p> : null}
      {entries.map((entry) => <article key={entry.id} className="space-y-3 rounded-xl border p-3">
        <p className="font-medium">{t(`expenses.history.${entry.action}`)} · {t('trips.version')} {formatNumber(entry.version, locale)}</p>
        <p className="text-sm">{formatDate(entry.createdAt, locale, TRIP_HISTORY_DATE_FORMAT)} · {t(`trips.actor.${entry.actor}`)}</p>
        <div className="grid gap-3 sm:grid-cols-2">{entry.before ? <Snapshot title={t('expenses.history.before')} value={entry.before} labels={labels} /> : null}<Snapshot title={t('expenses.history.after')} value={entry.after} labels={labels} /></div>
      </article>)}
      {query.hasNextPage ? <Button className="min-h-11" variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('trips.loadMore')}</Button> : null}
    </div>
  </Dialog>;
}
function Snapshot({ title, value, labels }: { title: string; value: z.infer<typeof tripSnapshotSchema>; labels: TripHistoryLabels }) {
  const { t, locale } = useI18n();
  const paymentLabel = OCR_PAYMENT_OPTIONS.find((option) => option.value === value.paymentMethod)?.labelKey ?? 'trips.ocr.paymentUnknown';
  return <div className="min-w-0 space-y-1 text-sm"><p className="font-semibold">{title}</p>
    <p>{t('trips.field.startedAt')}: {formatDate(value.startedAt, locale, TRIP_HISTORY_DATE_FORMAT)}</p>
    <p>{t('trips.field.endedAt')}: {formatDate(value.endedAt, locale, TRIP_HISTORY_DATE_FORMAT)}</p>
    <p className="break-all">{t('trips.field.vehicle')}: {labels.vehicles.get(value.vehicleId) ?? value.vehicleId}</p>
    <p className="break-all">{t('trips.field.app')}: {labels.apps.get(value.driverAppId) ?? value.driverAppId}</p>
    {value.areaId ? <p className="break-all">{t('trips.field.area')}: {labels.areas.get(value.areaId) ?? value.areaId}</p> : null}
    <p>{t('trips.ocr.fieldPayment')}: {t(paymentLabel)}</p>
    {TRIP_HISTORY_AMOUNTS.map((field) => <p key={field.field}>{t(field.label)}: {formatMoney(value[field.field], locale)}</p>)}
    <p>{t('trips.tripKm')}: {formatKm(value.totalKmMeters, locale)} {t('common.km')}</p>
    <p>{t('trips.tripPaidKm')}: {formatKm(value.paidKmMeters, locale)} {t('common.km')}</p>
    <p>{t(value.deletedAt ? 'trips.view.deleted' : 'trips.view.active')}</p>
    <p>{t(`trips.source.${value.source}`)}</p>
  </div>;
}
