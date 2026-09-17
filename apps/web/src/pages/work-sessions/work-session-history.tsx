import { useInfiniteQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDate, formatDuration } from '@/lib/format';
import { WorkSessionsApi, type WorkSessionSnapshot } from './work-sessions.api';
import { WORK_SESSION_DATE_FORMAT } from './work-sessions.control';

export function WorkSessionHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const query = useInfiniteQuery({ queryKey: ['work-sessions', 'history', id], initialPageParam: '',
    queryFn: ({ pageParam }) => WorkSessionsApi.history(id, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <Dialog open title={t('workSessions.history')} onClose={onClose} size="lg">
    <div className="space-y-4"><p className="text-sm text-muted-foreground">{t('workSessions.historyGuidance')}</p>
      {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {query.isError ? <div role="alert"><p>{t('workSessions.loadFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
      {query.isSuccess && items.length === 0 ? <p>{t('workSessions.historyEmpty')}</p> : null}
      <ol className="space-y-4">{items.map((item) => <li key={item.id} className="space-y-3 border-b pb-4">
        <h3 className="font-medium">{t(`workSessions.change.${item.action}`)} · {formatDate(item.createdAt, locale, WORK_SESSION_DATE_FORMAT)}</h3>
        <div className="grid gap-4 sm:grid-cols-2">{item.before ? <Snapshot value={item.before} label={t('expenses.history.before')} /> : <p>{t('workSessions.newRecord')}</p>}
          <Snapshot value={item.after} label={t('expenses.history.after')} /></div>
      </li>)}</ol>
      {query.hasNextPage ? <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('common.loadMore')}</Button> : null}
    </div>
  </Dialog>;
}
function Snapshot({ value, label }: { value: WorkSessionSnapshot; label: string }) {
  const { t, locale } = useI18n();
  return <section className="min-w-0 space-y-1 text-sm" aria-label={label}>
    <h4 className="font-medium">{label} · {t('expenses.history.version', { version: value.version })}</h4>
    <p>{formatDate(value.startedAt, locale, WORK_SESSION_DATE_FORMAT)}</p>
    <p>{value.endedAt ? formatDate(value.endedAt, locale, WORK_SESSION_DATE_FORMAT) : t('workSessions.open')}</p>
    <p>{formatDuration(value.activeMinutes, locale)}</p>
    <p>{t(value.driverAppId ? 'workSessions.platformSession' : 'workSessions.overallSession')}</p>
    <p>{t(value.deletedAt ? 'workSessions.deleted' : 'workSessions.active')}</p>
  </section>;
}
