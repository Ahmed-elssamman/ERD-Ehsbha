import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useWellness } from '@/lib/wellness/use-wellness';
import { Button } from '@/components/ui/button';
import { reportWellnessRows } from './reports.control';

export function ReportWellness({ startsOn, endsOn }: { startsOn: string; endsOn: string }) {
  const { t } = useI18n(), wellness = useWellness();
  const rows = wellness.state ? reportWellnessRows(wellness.state, startsOn, endsOn, t) : [];
  const answered = rows.some((row) => row.recorded > 0);
  function retry() { void wellness.reload(); }
  return <section className="space-y-3 border-t pt-5" aria-label={t('reports.wellness.title')}>
    <h2 className="font-semibold">{t('reports.wellness.title')}</h2><p className="text-sm text-muted-foreground">{t('reports.wellness.help')}</p>
    {wellness.error ? <div role="alert" className="space-y-2"><p>{t('reports.wellness.failed')}</p><Button variant="outline" onClick={retry}>{t('common.retry')}</Button></div>
      : !wellness.state ? <p role="status">{t('common.loading')}</p> : answered ? <dl className="space-y-2 text-sm">{rows.map((row) => <div key={row.kind} className="flex flex-wrap justify-between gap-2"><dt>{row.label}</dt><dd>{row.summary}</dd></div>)}</dl>
        : <p>{t('reports.wellness.empty')}</p>}
    <Link to="/wellness" className="inline-flex min-h-11 items-center text-sm underline">{t('reports.wellness.open')}</Link>
  </section>;
}
