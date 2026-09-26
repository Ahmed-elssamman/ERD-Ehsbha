import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartErrorBoundary } from '@/components/ui/chart-error-boundary';
import { useI18n } from '@/i18n';
import { ScoreApi } from '@/lib/api/endpoints';
import { formatDate, formatNumber } from '@/lib/format';
import { SCORE_FACTORS } from './driver-score.control';
import { useBusinessDate } from '@/hooks/use-business-date';

export function DriverScorePage() {
  const { t, locale } = useI18n();
  const calendarDate = useBusinessDate();
  const today = useQuery({ queryKey: ['score', 'today', calendarDate], queryFn: ScoreApi.today });
  const history = useQuery({ queryKey: ['score', 'history', calendarDate], queryFn: () => ScoreApi.history() });
  const rows = [...(history.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const chart = rows.map((row) => ({ date: formatDate(row.date, locale, { day: 'numeric', month: 'short' }), overall: row.overall }));
  return <div className="space-y-6">
    <PageHeader title={t('workScore.title')} subtitle={t('workScore.subtitle')} />
    <p className="rounded-xl border p-4 text-sm text-muted-foreground">{t('workScore.meaning')}</p>
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="score-today">
      <h2 id="score-today" className="text-lg font-semibold">{t('workScore.today')}</h2>
      {today.isLoading ? <Skeleton className="h-32 w-full" /> : today.isError ? <div role="alert" className="space-y-2"><p>{t('workScore.loadError')}</p><Button variant="outline" onClick={() => { void today.refetch(); }}>{t('common.retry')}</Button></div> : today.data ? <>
        <p className="text-4xl font-semibold num-tabular">{today.data.overall === null ? t('workScore.unavailable') : `${formatNumber(today.data.overall, locale)} / 100`}</p>
        {today.data.overall === null && <p className="text-sm text-muted-foreground">{t('workScore.insufficient')}</p>}
        <dl className="grid gap-4 sm:grid-cols-3">{SCORE_FACTORS.map((factor) => {
          const value = today.data?.[factor.key] ?? null;
          return <div key={factor.key} className="space-y-2 rounded-lg border p-4"><dt className="font-medium">{t(factor.label)}</dt><dd className="text-2xl num-tabular">{value === null ? t('workScore.unavailable') : formatNumber(value, locale)}</dd><dd className="text-sm text-muted-foreground">{t(factor.hint)}</dd></div>;
        })}</dl>
      </> : <p>{t('workScore.insufficient')}</p>}
    </section>
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="score-history">
      <h2 id="score-history" className="text-lg font-semibold">{t('workScore.history')}</h2>
      <p className="text-sm text-muted-foreground">{t('workScore.historyHint')}</p>
      {history.isLoading ? <Skeleton className="h-64 w-full" /> : history.isError ? <div role="alert" className="space-y-2"><p>{t('workScore.historyError')}</p><Button variant="outline" onClick={() => { void history.refetch(); }}>{t('common.retry')}</Button></div> : rows.length ? <>
        {rows.some((row) => row.overall !== null) && <ChartErrorBoundary fallbackText={t('analytics.chartError')}><div className="h-64" role="img" aria-label={t('score.historyChartAria')}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={11} /><YAxis domain={[0, 100]} /><Tooltip /><Area dataKey="overall" type="linear" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></ChartErrorBoundary>}
        <ul className="divide-y">{rows.map((row) => <li key={row.date} className="flex justify-between gap-4 py-3 text-sm"><span>{formatDate(row.date, locale)}</span><span>{row.overall === null ? t('workScore.unavailable') : `${formatNumber(row.overall, locale)} / 100`}</span></li>)}</ul>
      </> : <p className="text-sm">{t('workScore.noHistory')}</p>}
    </section>
    <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">{t('wellness.title')}</h2><p className="text-sm text-muted-foreground">{t('wellness.subtitle')}</p><Link to="/wellness" className="inline-flex min-h-11 items-center text-foreground underline">{t('wellness.open')}</Link></section>
  </div>;
}
