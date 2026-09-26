import { Link } from 'react-router-dom';
import type { ReportReadyData } from '@ehsbha/api-contracts';
import { ReportPeriod } from '@ehsbha/shared-types';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';

export function ReportReadyCard({ data }: { data: ReportReadyData }) {
  const { t, locale } = useI18n();
  const period = t(data.period === ReportPeriod.Weekly ? 'reports.weekly' : 'reports.monthly');
  const range = t('reports.range', { start: formatDate(`${data.startsOn}T12:00:00Z`, locale), end: formatDate(`${data.endsOn}T12:00:00Z`, locale) });
  return <div className="space-y-2 text-sm">
    <p>{period} · {range}</p>
    <Link className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium hover:bg-accent" to={`/reports/${data.reportId}/revisions/${data.version}`}>{t('reports.open')}</Link>
  </div>;
}
