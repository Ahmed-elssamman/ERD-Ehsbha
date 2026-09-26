import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { isCalendarDate } from '@ehsbha/shared-types';
import { MaintenanceApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAINTENANCE_DATE_FORMAT } from './maintenance.control';

interface Props { vehicleId: string; amountPiastres: number; date: string; linkedExpenseId: string | null; disabled: boolean; onChange: (id: string | null) => void }
export function MaintenanceLinkPicker({ vehicleId, amountPiastres, date, linkedExpenseId, disabled, onChange }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [chosenDate, setChosenDate] = useState('');
  const searchDate = chosenDate || date;
  const valid = isCalendarDate(searchDate) && Number.isInteger(amountPiastres) && amountPiastres > 0 && amountPiastres <= 2_147_483_647;
  const results = useInfiniteQuery({ queryKey: ['maintenance', 'expense-links', vehicleId, searchDate, amountPiastres],
    queryFn: ({ pageParam }) => MaintenanceApi.linkableExpenses(vehicleId, { date: searchDate, amountPiastres, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '', getNextPageParam: (page) => page.nextCursor, enabled: open && valid && !linkedExpenseId });
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];
  return <div className="space-y-2 rounded-xl border p-3">
    <p className="text-sm">{t('maintenance.link.explanation')}</p>
    {linkedExpenseId ? <><p className="break-all text-sm">{t('maintenance.link.linked')} · {linkedExpenseId}</p>
      <Button type="button" className="min-h-11" variant="outline" disabled={disabled} onClick={() => onChange(null)}>{t('maintenance.link.unlink')}</Button></>
      : <Button type="button" className="min-h-11" variant="outline" disabled={disabled || !valid} onClick={() => setOpen(!open)}>{t('maintenance.link.search')}</Button>}
    {open && !linkedExpenseId ? <div className="space-y-2">
      <Label htmlFor="maintenance-expense-date">{t('maintenance.link.searchDate')}</Label>
      <Input id="maintenance-expense-date" type="date" value={searchDate} disabled={disabled} onChange={(event) => setChosenDate(event.target.value)} />
      <p className="text-sm text-muted-foreground">{t('maintenance.link.searchHint')}</p>
      {results.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {results.isError ? <div role="alert"><p>{t('maintenance.link.failed')}</p><Button type="button" variant="outline" onClick={() => void results.refetch()}>{t('common.retry')}</Button></div> : null}
      {results.isSuccess && !items.length ? <p>{t('maintenance.link.empty')}</p> : null}
      {items.map((item) => <Button key={item.id} type="button" variant="outline" className="h-auto min-h-11 w-full flex-wrap justify-between gap-2" disabled={disabled} onClick={() => onChange(item.id)}>
        <span>{formatDate(item.dateTime, locale, MAINTENANCE_DATE_FORMAT)}</span><span>{formatMoney(item.amountPiastres, locale)}</span></Button>)}
      {results.hasNextPage ? <Button type="button" variant="outline" disabled={disabled} loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>{t('maintenance.loadMore')}</Button> : null}
    </div> : null}
  </div>;
}
