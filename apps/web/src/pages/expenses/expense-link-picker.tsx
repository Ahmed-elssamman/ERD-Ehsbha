import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExpenseCategory, isCalendarDate } from '@ehsbha/shared-types';
import { ExpensesApi, type ExpenseLinkableTripsInput } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_DATE_FORMAT } from './expenses.control';

interface Props {
  category: ExpenseCategory; amountPiastres: number; date: string; vehicleId: string;
  linkedTripId: string | null; onChange: (id: string | null) => void; disabled: boolean;
}

export function ExpenseLinkPicker({ category, amountPiastres, date, vehicleId, linkedTripId, onChange, disabled }: Props) {
  const { t, locale } = useI18n();
  const [selectedDate, setSearchDate] = useState('');
  const searchDate = selectedDate || date;
  const [search, setSearch] = useState<ExpenseLinkableTripsInput | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['expenses', 'linkable', search], enabled: search !== null,
    initialPageParam: '',
    queryFn: ({ pageParam }) => ExpensesApi.linkableTrips({ date: search?.date ?? date, category: search?.category ?? category,
      amountPiastres: search?.amountPiastres ?? amountPiastres, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (page) => page.nextCursor,
  });
  if (category !== ExpenseCategory.Toll && category !== ExpenseCategory.Parking) return null;
  const canSearch = isCalendarDate(searchDate) && Number.isInteger(amountPiastres) && amountPiastres > 0 && amountPiastres <= 2_147_483_647;
  const matchesCurrent = search?.category === category && search.amountPiastres === amountPiastres;
  const candidates = matchesCurrent ? query.data?.pages.flatMap((page) => page.items) ?? [] : [];
  function findTrips() {
    if (canSearch) setSearch({ date: searchDate, category, amountPiastres });
  }
  function unlink() { onChange(null); setSearch(null); }
  return <section className="space-y-3 rounded-lg border p-3" aria-label={t('expenses.link.title')}>
    <h3 className="text-sm font-semibold">{t('expenses.link.title')}</h3>
    <p className="text-sm text-muted-foreground">{t('expenses.link.explanation')}</p>
    {linkedTripId ? <div className="space-y-2">
      <p className="text-sm">{t('expenses.link.locked')}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11"><Link to={`/trips/${linkedTripId}`} target="_blank" rel="noopener noreferrer">{t('expenses.link.viewTrip')}</Link></Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={unlink}>{t('expenses.link.unlink')}</Button>
      </div>
    </div> : <>
      <Label htmlFor="expense-trip-search-date">{t('expenses.link.searchDate')}</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="expense-trip-search-date" type="date" className="min-h-11 min-w-0 flex-1" value={searchDate} disabled={disabled} onChange={(event) => setSearchDate(event.target.value)} />
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !canSearch} onClick={findTrips}>{t('expenses.link.search')}</Button>
      </div>
      {search && matchesCurrent ? <>
        {query.isFetching && !query.data ? <p role="status" className="text-sm">{t('common.loading')}</p> : null}
        {query.isError ? <div role="alert" className="space-y-2 text-sm"><p>{t('expenses.link.loadFailed')}</p><Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
        {query.isSuccess && candidates.length === 0 ? <p className="text-sm">{t('expenses.link.empty')}</p> : null}
        <ul className="space-y-2">{candidates.map((trip) => {
          const wrongVehicle = !!vehicleId && vehicleId !== trip.vehicleId;
          return <li key={trip.id} className="space-y-1 rounded-md border p-2">
            <p className="text-sm">{trip.appName} · {formatDate(trip.startedAt, locale, EXPENSE_DATE_FORMAT)}</p>
            {wrongVehicle ? <p className="text-sm text-muted-foreground">{t('expenses.link.vehicleMismatch')}</p> : null}
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled || wrongVehicle} onClick={() => onChange(trip.id)}>{t('expenses.link.select')}</Button>
          </li>;
        })}</ul>
        {query.hasNextPage ? <Button type="button" variant="outline" className="min-h-11" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('common.loadMore')}</Button> : null}
      </> : null}
    </>}
  </section>;
}
