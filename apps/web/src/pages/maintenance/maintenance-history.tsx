import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { MaintenanceSnapshot } from '@ehsbha/shared-types';
import { MaintenanceApi, type MaintenanceRecord } from '@/lib/api/endpoints';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MAINTENANCE_DATE_FORMAT } from './maintenance.control';

interface Props { record: MaintenanceRecord; onClose: () => void }
export function MaintenanceHistory({ record, onClose }: Props) {
  const { t, locale } = useI18n();
  const query = useInfiniteQuery({ queryKey: ['maintenance', 'history', record.vehicleId, record.id],
    queryFn: ({ pageParam }) => MaintenanceApi.history(record.vehicleId, record.id, pageParam || ''), initialPageParam: '', getNextPageParam: (page) => page.nextCursor });
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <Dialog open onClose={onClose} title={t('maintenance.history')}>
    <div className="space-y-4"><p className="text-sm text-muted-foreground">{t('maintenance.historyHint')}</p>
      {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {query.isError ? <div role="alert"><p>{t('maintenance.historyFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
      {query.isSuccess && !entries.length ? <p>{t('maintenance.noHistory')}</p> : null}
      {entries.map((entry) => <article key={entry.id} className="space-y-3 rounded-xl border p-3">
        <p className="font-medium">{t(`expenses.history.${entry.action}`)} · {t('maintenance.version')} {formatNumber(entry.version, locale)}</p>
        <p className="text-sm">{formatDate(entry.createdAt, locale, MAINTENANCE_DATE_FORMAT)}</p>
        <div className="grid gap-3 sm:grid-cols-2">{entry.before ? <Snapshot title={t('expenses.history.before')} value={entry.before} /> : null}
          <Snapshot title={t('expenses.history.after')} value={entry.after} /></div>
      </article>)}
      {query.hasNextPage ? <Button className="min-h-11" variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('maintenance.loadMore')}</Button> : null}
    </div>
  </Dialog>;
}
function Snapshot({ title, value }: { title: string; value: MaintenanceSnapshot }) {
  const { t, locale } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const items = useQuery({ queryKey: ['maintenance', 'items'], queryFn: MaintenanceApi.items });
  const item = items.data?.find((candidate) => candidate.id === value.maintenanceItemId);
  return <div className="min-w-0 space-y-1 text-sm"><p className="font-semibold">{title}</p>
    <p className="break-all">{item ? itemLabel(item) : value.maintenanceItemId}</p>
    <p>{formatMoney(value.costPiastres, locale)}</p><p>{formatDate(value.performedAt, locale, MAINTENANCE_DATE_FORMAT)}</p>
    <p>{t('maintenance.field.odometer')}: {formatKm(value.odometerMeters, locale)}</p>
    <p>{t(value.deletedAt ? 'maintenance.view.deleted' : 'maintenance.view.active')}</p>
    <p className="break-all">{value.linkedExpenseId ? `${t('maintenance.link.linked')}: ${value.linkedExpenseId}` : t('maintenance.link.unlinked')}</p>
  </div>;
}
