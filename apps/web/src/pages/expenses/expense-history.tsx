import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ExpenseSnapshot } from '@ehsbha/shared-types';
import { ExpensesApi, VehiclesApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EXPENSE_DATE_FORMAT } from './expenses.control';

interface Props { expenseId: string; onClose: () => void }

export function ExpenseHistory({ expenseId, onClose }: Props) {
  const { t, locale } = useI18n();
  const query = useInfiniteQuery({ queryKey: ['expenses', 'history', expenseId], initialPageParam: '',
    queryFn: ({ pageParam }) => ExpensesApi.history(expenseId, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <Dialog open onClose={onClose} title={t('expenses.history.title')} size="lg">
    <p className="mb-4 text-sm text-muted-foreground">{t('expenses.history.explanation')}</p>
    {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
    {query.isError ? <div role="alert" className="space-y-2"><p>{t('expenses.history.loadFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
    {query.isSuccess && items.length === 0 ? <p>{t('expenses.history.empty')}</p> : null}
    <ol className="space-y-4">{items.map((revision) => <li key={revision.id} className="space-y-3 rounded-lg border p-3">
      <h3 className="font-semibold">{t(`expenses.history.${revision.action}`)} · {formatDate(revision.createdAt, locale, EXPENSE_DATE_FORMAT)}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {revision.before ? <Snapshot value={revision.before} label={t('expenses.history.before')} /> : <p className="text-sm">{t('expenses.history.newRecord')}</p>}
        <Snapshot value={revision.after} label={t('expenses.history.after')} />
      </div>
    </li>)}</ol>
    {query.hasNextPage ? <Button variant="outline" className="mt-4 min-h-11" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('common.loadMore')}</Button> : null}
  </Dialog>;
}

function Snapshot({ value, label }: { value: ExpenseSnapshot; label: string }) {
  const { t, locale } = useI18n();
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const vehicle = vehicles.data?.find((row) => row.id === value.vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || t(`settings.vehicleType.${vehicle.type}`)
    : t(value.vehicleId ? 'expenses.history.unavailableVehicle' : 'expenses.noVehicle');
  return <section className="min-w-0 space-y-2 text-sm" aria-label={label}>
    <h4 className="font-medium">{label} · {t('expenses.history.version', { version: value.version })}</h4>
    <p>{t(`expenses.category.${value.category}`)} · {formatMoney(value.amountPiastres, locale)}</p>
    <p>{formatDate(value.dateTime, locale, EXPENSE_DATE_FORMAT)}</p>
    <p>{vehicleLabel}</p>
    <p>{t(value.isRecurring ? 'expenses.history.recurring' : 'expenses.history.once')}</p>
    {value.recurrenceRule ? <p className="break-words">{value.recurrenceRule}</p> : null}
    <p>{t(value.deletedAt ? 'expenses.view.deleted' : 'expenses.view.active')}</p>
    {value.deletedAt ? <p>{formatDate(value.deletedAt, locale, EXPENSE_DATE_FORMAT)}</p> : null}
    {value.linkedTripId ? <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/trips/${value.linkedTripId}`} target="_blank" rel="noopener noreferrer">{t('expenses.link.viewTrip')}</Link>
      : <p>{t('expenses.history.unlinked')}</p>}
  </section>;
}
