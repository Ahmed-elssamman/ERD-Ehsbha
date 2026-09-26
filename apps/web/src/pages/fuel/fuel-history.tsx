import { useInfiniteQuery } from '@tanstack/react-query';
import { fuelQuantityUnit, type FuelSnapshot } from '@ehsbha/shared-types';
import { FuelApi, type FuelEntry } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FUEL_DATE_FORMAT } from './fuel.control';

interface Props { record: FuelEntry; onClose: () => void }
export function FuelHistory({ record, onClose }: Props) {
  const { t, locale } = useI18n();
  const query = useInfiniteQuery({ queryKey: ['fuel', 'history', record.id], queryFn: ({ pageParam }) => FuelApi.history(record.id, pageParam || ''), initialPageParam: '', getNextPageParam: (page) => page.nextCursor });
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <Dialog open onClose={onClose} title={t('fuel.history')}>
    <div className="space-y-4"><p className="text-sm text-muted-foreground">{t('fuel.historyHint')}</p>
      {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {query.isError ? <div role="alert"><p>{t('fuel.historyFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
      {query.isSuccess && !entries.length ? <p>{t('fuel.noHistory')}</p> : null}
      {entries.map((entry) => <article key={entry.id} className="space-y-3 rounded-xl border p-3">
        <p className="font-medium">{t(`expenses.history.${entry.action}`)} · {t('fuel.version')} {formatNumber(entry.version, locale)}</p>
        <p className="text-sm">{formatDate(entry.createdAt, locale, FUEL_DATE_FORMAT)}</p>
        <div className="grid gap-3 sm:grid-cols-2">{entry.before ? <Snapshot title={t('expenses.history.before')} value={entry.before} /> : null}<Snapshot title={t('expenses.history.after')} value={entry.after} /></div>
      </article>)}
      {query.hasNextPage ? <Button className="min-h-11" variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('fuel.loadMore')}</Button> : null}
    </div>
  </Dialog>;
}
function Snapshot({ title, value }: { title: string; value: FuelSnapshot }) {
  const { t, locale } = useI18n();
  const unit = fuelQuantityUnit(value.fuelKind);
  return <div className="min-w-0 space-y-1 text-sm"><p className="font-semibold">{title}</p>
    <p>{formatMoney(value.totalPiastres, locale)}</p><p>{formatDate(value.dateTime, locale, FUEL_DATE_FORMAT)}</p>
    <p>{t(value.fuelKind ? `settings.fuelTypes.${value.fuelKind}` : 'fuel.kindUnknown')}</p>
    <p>{t('fuel.field.quantity')}: {value.quantity === null ? t('fuel.missing') : `${formatNumber(value.quantity, locale, 3)} ${t(unit ? `fuel.unit.${unit}` : 'fuel.unitUnknown')}`}</p>
    <p>{t('fuel.field.unitPrice')}: {value.pricePerUnitPiastres === null ? t('fuel.missing') : formatMoney(value.pricePerUnitPiastres, locale)}</p>
    <p>{t('fuel.field.odometer')}: {value.odometerMeters === null ? t('fuel.missing') : formatKm(value.odometerMeters, locale, 3)}</p>
    <p>{t(value.isFullTank ? 'fuel.full' : 'fuel.partial')} · {t(`fuel.coverage.${value.fillCoverage}`)}</p>
    <p>{t(value.deletedAt ? 'fuel.view.deleted' : 'fuel.view.active')}</p>
    <p className="break-all">{t('fuel.vehicle')}: {value.vehicleId}</p>
    <p className="break-all">{value.linkedExpenseId ? `${t('fuel.link.linked')}: ${value.linkedExpenseId}` : t('fuel.link.unlinked')}</p>
  </div>;
}
