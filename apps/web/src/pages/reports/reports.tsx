import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { useI18n } from '@/i18n';
import { ReportsApi } from './reports.api';
import { ReportEditor } from './report-editor';
import { ReportPreferencesEditor } from './report-preferences-editor';
import { newReportContext, type ReportDraftContext } from './report-draft.control';
import { reportSummaryView } from './reports.control';
import { reportMinuteTime } from './report-preferences.control';

export function ReportsPage() {
  const { t, locale } = useI18n();
  const [createContext, setCreateContext] = useState<ReportDraftContext | null>(null), [editingPreferences, setEditingPreferences] = useState(false);
  const archive = useInfiniteQuery({ queryKey: ['reports', 'list'], initialPageParam: '', queryFn: ({ pageParam }) => ReportsApi.list(pageParam), getNextPageParam: (last) => last.nextCursor, retry: false, networkMode: 'always' });
  const preferences = useQuery({ queryKey: ['report-preferences'], queryFn: ReportsApi.preferences, retry: false, networkMode: 'always' });
  const items = [...new Map((archive.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()].map((item) => reportSummaryView(item, locale, t));
  const saved = preferences.data;
  function create() { setCreateContext(newReportContext()); }
  function closeCreate() { setCreateContext(null); }
  function closePreferences() { setEditingPreferences(false); }
  function editPreferences() { setEditingPreferences(true); }
  function retry() { void archive.refetch(); }
  function more() { void archive.fetchNextPage(); }
  function retryPreferences() { void preferences.refetch(); }
  return <div className="space-y-6">
    <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} actions={<Button className="min-h-11" onClick={create}>{t('reports.create')}</Button>} />
    <p className="text-sm text-muted-foreground">{t('reports.archiveHelp')}</p>
    <RecordDraftList kind={RecordDraftKind.Report} render={(draft, close) => <ReportEditor context={null} scope={draft.scope} resumeOnly onClose={close} />} />
    {archive.isError && !archive.isFetchNextPageError ? <div role="alert" className="space-y-2"><p>{t('reports.loadFailed')}</p><Button variant="outline" onClick={retry}>{t('common.retry')}</Button></div> : null}
    {archive.isPending ? <p role="status">{t('common.loading')}</p> : items.length ? <ul className="divide-y rounded-xl border">
      {items.map((item) => <li key={item.id} className="space-y-1 p-4"><Link className="flex min-h-11 flex-wrap items-center justify-between gap-2 font-semibold hover:underline" to={item.href}>
        <span>{item.periodLabel}</span><span className="text-sm">{item.rangeLabel}</span></Link><p className="text-sm text-muted-foreground">{item.captureLabel}</p></li>)}
    </ul> : !archive.isError ? <div className="space-y-2"><EmptyState Icon={FileText} title={t('reports.empty')} /><p className="text-sm text-muted-foreground">{t('reports.emptyHelp')}</p></div> : null}
    {archive.isFetchNextPageError ? <p role="alert">{t('reports.moreFailed')}</p> : null}
    {archive.hasNextPage ? <Button variant="outline" className="min-h-11" onClick={more} loading={archive.isFetchingNextPage}>{t(archive.isFetchNextPageError ? 'common.retry' : 'reports.more')}</Button> : null}
    <section className="space-y-3 rounded-xl border p-4" aria-label={t('reports.settings.title')}>
      <h2 className="font-semibold">{t('reports.settings.title')}</h2><p className="text-sm text-muted-foreground">{t('reports.settings.guidance')}</p>
      {saved ? <><dl className="space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt>{t('reports.weekly')}</dt><dd>{t(saved.weeklyEnabled ? 'reports.settings.on' : 'reports.settings.off')}</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt>{t('reports.monthly')}</dt><dd>{t(saved.monthlyEnabled ? 'reports.settings.on' : 'reports.settings.off')}</dd></div></dl>
        <p className="text-sm">{t('reports.settings.timeSummary', { time: reportMinuteTime(saved.deliveryMinute) })}</p>
        <Button variant="outline" className="min-h-11" onClick={editPreferences}>{t('reports.settings.edit')}</Button></> : preferences.isPending ? <p role="status">{t('common.loading')}</p> : null}
      {preferences.isError ? <div role="alert" className="space-y-2"><p>{t('reports.settings.loadFailed')}</p><Button variant="outline" onClick={retryPreferences}>{t('common.retry')}</Button></div> : null}
      <RecordDraftList kind={RecordDraftKind.ReportPreferences} render={(_draft, close) => <ReportPreferencesEditor preferences={null} resumeOnly onClose={close} />} />
    </section>
    {createContext ? <ReportEditor context={createContext} scope="create" onClose={closeCreate} /> : null}
    {editingPreferences && saved ? <ReportPreferencesEditor preferences={saved} onClose={closePreferences} /> : null}
  </div>;
}
