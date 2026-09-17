import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkSessionMutation, WorkSessionView } from '@ehsbha/shared-types';
import { MAX_RECORDED_WORK_INTERVAL_MS } from '@ehsbha/api-contracts';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { formatDate, formatDuration } from '@/lib/format';
import { WorkSessionsApi, type WorkSessionRecord } from './work-sessions.api';
import { WorkSessionEditor } from './work-session-editor';
import { WorkSessionHistory } from './work-session-history';
import { WORK_SESSION_DATE_FORMAT, WORK_SESSION_VIEWS, workSessionErrorKey, type WorkSessionContext } from './work-sessions.control';

export function WorkSessionsPage() {
  const { t, locale } = useI18n(), qc = useQueryClient();
  const [view, setView] = useState(WorkSessionView.Active);
  const [editing, setEditing] = useState<WorkSessionContext | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const current = useQuery({ queryKey: ['work-sessions', 'open'], queryFn: WorkSessionsApi.open, staleTime: 0 });
  const list = useInfiniteQuery({ queryKey: ['work-sessions', 'list', view], initialPageParam: '',
    queryFn: ({ pageParam }) => WorkSessionsApi.list(view, pageParam), getNextPageParam: (page) => page.nextCursor });
  const open = current.data?.session ?? null;
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const abandoned = open !== null && Date.now() - new Date(open.startedAt).getTime() > MAX_RECORDED_WORK_INTERVAL_MS;
  function closeEditor() { setEditing(null); void qc.invalidateQueries({ queryKey: ['record-drafts'] }); }
  function retry() { setErrorKey(null); void current.refetch(); void list.refetch(); }
  async function begin(action: WorkSessionMutation, record: WorkSessionRecord | null = null) {
    setBusy(true); setErrorKey(null);
    try {
      if (action === WorkSessionMutation.Start || action === WorkSessionMutation.End) {
        if (action === WorkSessionMutation.Start && open) { setErrorKey('errors.SESSION_ALREADY_OPEN'); return; }
        if (action === WorkSessionMutation.End && !open) { setErrorKey('errors.SESSION_ALREADY_ENDED'); return; }
        // Use the displayed record and its version; an extra read must not delay or lose the intended time.
        setEditing({ action, record: open });
      } else setEditing({ action, record: record ? await WorkSessionsApi.get(record.id) : null });
    } catch (error) { setErrorKey(error instanceof Error ? workSessionErrorKey(error) : 'workSessions.loadFailed'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <header className="space-y-2"><h1 className="text-2xl font-bold">{t('workSessions.title')}</h1><p className="text-sm text-muted-foreground">{t('workSessions.explanation')}</p></header>
    <RecordDraftList kind={RecordDraftKind.WorkSession} render={(_draft, close) => <WorkSessionEditor resumeOnly context={{ action: WorkSessionMutation.Start, record: null }} onClose={close} />} />
    <section className="space-y-3 rounded-xl border p-4" aria-label={t('workSessions.current')}>
      {current.isError ? <div role="alert" className="space-y-2"><p>{t('workSessions.stateUnconfirmed')}</p><Button variant="outline" onClick={retry}>{t('common.retry')}</Button></div> : null}
      {current.isLoading ? <p role="status">{t('common.loading')}</p> : open ? <>
        <h2 className="font-semibold">{t('workSessions.open')}</h2><p>{formatDate(open.startedAt, locale, WORK_SESSION_DATE_FORMAT)}</p>
        <p className="text-sm text-muted-foreground">{t(open.driverAppId ? 'workSessions.platformSession' : 'workSessions.overallSession')}</p>
        <p className="text-sm">{t(abandoned ? 'workSessions.abandoned' : 'workSessions.openGuidance')}</p>
        <Button className="min-h-11" disabled={busy} onClick={() => void begin(WorkSessionMutation.End)}>{t('workSessions.action.session.end')}</Button>
      </> : <>{current.isSuccess ? <p>{t('workSessions.noneOpen')}</p> : null}<Button className="min-h-11" disabled={busy} onClick={() => void begin(WorkSessionMutation.Start)}>{t('workSessions.action.session.start')}</Button></>}
    </section>
    {errorKey ? <div role="alert" className="space-y-2 text-sm"><p>{t(errorKey)}</p><Button variant="outline" onClick={retry}>{t('common.retry')}</Button></div> : null}
    <section className="space-y-3" aria-label={t('workSessions.records')}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t('workSessions.records')}</h2>
        <Button variant="outline" disabled={busy} onClick={() => void begin(WorkSessionMutation.Create)}>{t('workSessions.action.session.create')}</Button></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('workSessions.view')}>
        {WORK_SESSION_VIEWS.map((item) => <Button key={item.value} variant={view === item.value ? 'default' : 'outline'} aria-pressed={view === item.value} onClick={() => setView(item.value)}>{t(item.label)}</Button>)}
      </div>
      {list.isLoading ? <p role="status">{t('common.loading')}</p> : null}
      {list.isError ? <div role="alert"><p>{t('workSessions.loadFailed')}</p><Button variant="outline" onClick={() => void list.refetch()}>{t('common.retry')}</Button></div> : null}
      {list.isSuccess && items.length === 0 ? <p className="py-6 text-muted-foreground">{t('workSessions.empty')}</p> : null}
      <ol className="divide-y">{items.map((row) => <li key={row.id} className="space-y-2 py-4" data-testid="work-session-record">
        <p className="font-medium">{formatDate(row.startedAt, locale, WORK_SESSION_DATE_FORMAT)}</p>
        <p className="text-sm">{row.endedAt ? `${formatDate(row.endedAt, locale, WORK_SESSION_DATE_FORMAT)} · ${formatDuration(row.activeMinutes, locale)}` : t('workSessions.open')}</p>
        <p className="text-sm text-muted-foreground">{t(row.driverAppId ? 'workSessions.platformSession' : 'workSessions.overallSession')}</p>
        <div className="flex flex-wrap gap-2">
          {row.deletedAt ? <Button variant="outline" disabled={busy} onClick={() => void begin(WorkSessionMutation.Restore, row)}>{t('workSessions.action.session.restore')}</Button> : <>
            {row.endedAt ? <Button variant="outline" disabled={busy} onClick={() => void begin(WorkSessionMutation.Correct, row)}>{t('workSessions.action.session.correct')}</Button> : null}
            <Button variant="ghost" disabled={busy} onClick={() => void begin(WorkSessionMutation.Delete, row)}>{t('workSessions.action.session.delete')}</Button>
          </>}
          <Button variant="ghost" onClick={() => setHistoryId(row.id)}>{t('workSessions.history')}</Button>
        </div>
      </li>)}</ol>
      {list.hasNextPage ? <Button variant="outline" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('common.loadMore')}</Button> : null}
    </section>
    {editing ? <WorkSessionEditor context={editing} onClose={closeEditor} /> : null}
    {historyId ? <WorkSessionHistory id={historyId} onClose={() => setHistoryId(null)} /> : null}
  </div>;
}
