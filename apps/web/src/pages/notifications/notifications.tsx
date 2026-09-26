import { useState } from 'react';
import { ReportReadyCard } from '@/components/notifications/report-ready-card';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Sparkles } from 'lucide-react';
import { NotificationKind } from '@ehsbha/shared-types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { useI18n } from '@/i18n';
import { NotificationsApi } from '@/lib/api/endpoints';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DailyDigestCard } from '@/components/notifications/daily-digest-card';
import { NotificationPreferencesApi } from './notification-preferences.api';
import { NotificationPreferencesEditor } from './notification-preferences-editor';
import { minuteTime, notificationErrorKey, NOTIFICATION_FREQUENCIES, NOTIFICATION_PAGE_SIZE, NOTIFICATION_READ_BATCH_SIZE } from './notifications.control';

export function NotificationsPage() {
  const { t, locale } = useI18n(), qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const preferences = useQuery({ queryKey: ['notification-preferences'], queryFn: NotificationPreferencesApi.get, retry: false, networkMode: 'always' });
  const inbox = useInfiniteQuery({ queryKey: ['notifications'], initialPageParam: '', retry: false, networkMode: 'always',
    queryFn: ({ pageParam }) => NotificationsApi.list({ limit: NOTIFICATION_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor });
  const items = [...new Map((inbox.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()];
  const unread = items.filter((item) => !item.readAt);
  const mark = useMutation({ networkMode: 'always', mutationFn: async (ids: string[]) => {
    setReadFailed(false);
    let failed = false;
    for (let index = 0; index < ids.length; index += NOTIFICATION_READ_BATCH_SIZE) {
      const results = await Promise.allSettled(ids.slice(index, index + NOTIFICATION_READ_BATCH_SIZE).map((id) => NotificationsApi.markRead(id)));
      if (results.some((result) => result.status === 'rejected')) failed = true;
    }
    return failed;
  }, onSuccess: (failed) => { setReadFailed(failed); void qc.invalidateQueries({ queryKey: ['notifications'] }); }, onError: () => setReadFailed(true) });
  const digest = useMutation({ networkMode: 'always', mutationFn: NotificationsApi.triggerDailyDigest,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); } });
  function markDisplayed() { mark.mutate(unread.map((item) => item.id)); }
  function refreshDigest() { digest.mutate(); }
  function retryInbox() { void inbox.refetch(); }
  function loadMore() { void inbox.fetchNextPage(); }
  function editPreferences() { setEditing(true); }
  function closePreferences() { setEditing(false); }
  const saved = preferences.data;
  const frequencyLabel = saved ? NOTIFICATION_FREQUENCIES.find((item) => item.value === saved.digestFrequency)?.label ?? '' : '';
  return <div className="space-y-6 animate-fade-in">
    <PageHeader title={t('notifications.title')} subtitle={t('notifications.subtitle')} actions={<div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={refreshDigest} loading={digest.isPending} className="min-h-11 gap-2"><Sparkles className="h-4 w-4" aria-hidden />{t('notifications.refreshDigest')}</Button>
      {unread.length ? <Button variant="outline" onClick={markDisplayed} loading={mark.isPending} className="min-h-11 gap-2"><Check className="h-4 w-4" aria-hidden />{t('notifications.markDisplayed', { count: unread.length })}</Button> : null}
    </div>} />
    <p className="text-sm text-muted-foreground">{t('notifications.manualHelp')}</p>
    {digest.isError ? <p role="alert">{t(notificationErrorKey(digest.error))}</p> : digest.isSuccess ? <p role="status">{t('notifications.digestReady')}</p> : null}
    {readFailed ? <p role="alert">{t('notifications.readFailed')}</p> : null}
    <section aria-label={t('notifications.settings.title')} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t('notifications.settings.title')}</h2>
      {saved ? <><p className="text-sm">{saved.digestEnabled ? t('notifications.settings.summary', { frequency: t(frequencyLabel), time: minuteTime(saved.deliveryMinute) }) : t('notifications.settings.disabled')}</p>
        {saved.quietEnabled ? <p className="text-sm">{t('notifications.settings.quietSummary', { start: minuteTime(saved.quietStartMinute), end: minuteTime(saved.quietEndMinute) })}</p> : null}
        <Button variant="outline" className="min-h-11" onClick={editPreferences}>{t('notifications.settings.edit')}</Button></> : preferences.isPending ? <p role="status">{t('common.loading')}</p> : null}
      {preferences.isError ? <div role="alert" className="space-y-2"><p>{t('notifications.settings.loadFailed')}</p><Button variant="outline" onClick={() => void preferences.refetch()}>{t('common.retry')}</Button></div> : null}
      <RecordDraftList kind={RecordDraftKind.NotificationPreferences} render={(_draft, close) => <NotificationPreferencesEditor preferences={null} resumeOnly onClose={close} />} />
    </section>
    {editing && saved ? <NotificationPreferencesEditor preferences={saved} onClose={closePreferences} /> : null}
    {inbox.isError && !inbox.isFetchNextPageError ? <div role="alert" className="space-y-2"><p>{t('notifications.loadFailed')}</p><Button variant="outline" onClick={retryInbox}>{t('common.retry')}</Button></div> : null}
    <Card><CardContent className="p-0">
      {inbox.isPending ? <div role="status" aria-label={t('common.loading')} className="p-5"><Skeleton className="h-24 w-full" /></div>
        : items.length === 0 && !inbox.isError ? <EmptyState Icon={Bell} title={t('notifications.empty')} /> : <ul className="divide-y divide-border/60">
          {items.map((item) => <li key={item.id} className={cn('space-y-3 break-words p-4 sm:p-5', !item.readAt && 'bg-primary/5')}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
              <p className="font-semibold">{item.kind === NotificationKind.DailyDigest ? t('notifications.digest.title') : item.kind === NotificationKind.ReportReady ? t('reports.ready') : item.title}</p>
              {!item.data ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.sentAt, locale)} · <span dir="ltr">{formatTime(item.sentAt, locale)}</span></p>
            </div>{!item.readAt ? <Button variant="ghost" size="sm" disabled={mark.isPending} onClick={() => mark.mutate([item.id])} className="min-h-11">{t('notifications.markRead')}</Button> : null}</div>
            {item.data?.kind === NotificationKind.DailyDigest ? <DailyDigestCard data={item.data} /> : item.data?.kind === NotificationKind.ReportReady ? <ReportReadyCard data={item.data} /> : null}
          </li>)}
        </ul>}
    </CardContent></Card>
    {inbox.isFetchNextPageError ? <p role="alert">{t('notifications.moreFailed')}</p> : null}
    {inbox.hasNextPage ? <Button variant="outline" className="min-h-11" loading={inbox.isFetchingNextPage} onClick={loadMore}>{t(inbox.isFetchNextPageError ? 'common.retry' : 'notifications.loadMore')}</Button> : null}
  </div>;
}
