import type { ReportContent, ReportTotals, ReportSummary } from '@ehsbha/api-contracts';
import { ReportPeriod } from '@ehsbha/shared-types';
import type { Locale } from '@/i18n';
import { formatDate, formatMoney, formatKm, formatDuration, formatNumber } from '@/lib/format';
import { ChecklistAnswer, REMINDERS, type WellnessState } from '@/lib/wellness/wellness.control';

export enum ReportMetricFormat { Money = 'money', Count = 'count', Distance = 'distance', Duration = 'duration' }
interface ReportMetric { key: keyof ReportTotals; label: string; format: ReportMetricFormat }
export interface ReportTranslator { (key: string, vars?: Record<string, string | number>): string }
export const REPORT_METRICS: ReportMetric[] = [
  { key: 'netPiastres', label: 'reports.net', format: ReportMetricFormat.Money },
  { key: 'takeHomePiastres', label: 'reports.takeHome', format: ReportMetricFormat.Money },
  { key: 'totalCostsPiastres', label: 'reports.costs', format: ReportMetricFormat.Money },
  { key: 'tripCount', label: 'reports.trips', format: ReportMetricFormat.Count },
  { key: 'grossPiastres', label: 'reports.gross', format: ReportMetricFormat.Money },
  { key: 'commissionPiastres', label: 'reports.commission', format: ReportMetricFormat.Money },
  { key: 'totalKmMeters', label: 'reports.distance', format: ReportMetricFormat.Distance },
  { key: 'workMinutes', label: 'reports.hours', format: ReportMetricFormat.Duration },
  { key: 'netPerHourPiastres', label: 'reports.perHour', format: ReportMetricFormat.Money },
  { key: 'netPerKmPiastres', label: 'reports.perKm', format: ReportMetricFormat.Money },
];
export function reportRangeLabel(report: { startsOn: string; endsOn: string }, locale: Locale, t: ReportTranslator): string {
  return t('reports.range', { start: formatDate(`${report.startsOn}T12:00:00Z`, locale), end: formatDate(`${report.endsOn}T12:00:00Z`, locale) });
}
export function reportSummaryView(report: ReportSummary, locale: Locale, t: ReportTranslator) {
  return { ...report, periodLabel: t(report.period === ReportPeriod.Weekly ? 'reports.weekly' : 'reports.monthly'), rangeLabel: reportRangeLabel(report, locale, t),
    captureLabel: t('reports.capture', { version: report.version, date: formatDate(report.capturedAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) }),
    href: `/reports/${report.id}/revisions/${report.version}` };
}
function metricValue(value: number | null, format: ReportMetricFormat, locale: Locale, t: ReportTranslator): string {
  if (value === null) return t('reports.unavailable');
  switch (format) {
    case ReportMetricFormat.Money: return formatMoney(value, locale);
    case ReportMetricFormat.Distance: return t('reports.km', { value: formatKm(value, locale) });
    case ReportMetricFormat.Duration: return formatDuration(value, locale);
    case ReportMetricFormat.Count: return formatNumber(value, locale);
  }
}
export function reportMetrics(content: ReportContent, locale: Locale, t: ReportTranslator) {
  return REPORT_METRICS.map((metric) => ({ key: metric.key, label: t(metric.label), value: metricValue(content.totals[metric.key], metric.format, locale, t),
    previous: content.previous.totals.recordedDays ? metricValue(content.previous.totals[metric.key], metric.format, locale, t) : t('reports.noComparison') }));
}
export function reportObservations(content: ReportContent, locale: Locale, t: ReportTranslator): string[] {
  const days = content.days.filter((day) => day.recorded).sort((a, b) => b.totals.netPiastres - a.totals.netPiastres || a.date.localeCompare(b.date));
  const observations: string[] = [];
  const highest = days[0], lowest = days.at(-1);
  if (days.length > 1 && highest && lowest) {
    const formatDay = (date: string) => formatDate(`${date}T12:00:00Z`, locale);
    observations.push(t('reports.observedDays', { count: days.length }));
    observations.push(t('reports.highestDay', { date: formatDay(highest.date), net: formatMoney(highest.totals.netPiastres, locale), count: highest.totals.tripCount }));
    observations.push(t('reports.lowestDay', { date: formatDay(lowest.date), net: formatMoney(lowest.totals.netPiastres, locale), count: lowest.totals.tripCount }));
  }
  if (content.totals.recordedDays && content.previous.totals.recordedDays) {
    const difference = content.totals.netPiastres - content.previous.totals.netPiastres;
    if (Number.isSafeInteger(difference)) observations.push(t(difference >= 0 ? 'reports.netIncreased' : 'reports.netDecreased', { amount: formatMoney(Math.abs(difference), locale) }));
  }
  if (content.largestCosts.length) observations.push(t('reports.reviewCosts'));
  if (!content.totals.workMinutes) observations.push(t('reports.recordHours'));
  return observations;
}
export function reportWellnessRows(state: WellnessState, startsOn: string, endsOn: string, t: ReportTranslator) {
  const days = state.days.filter((day) => day.date >= startsOn && day.date <= endsOn);
  return REMINDERS.map(({ kind }) => {
    const answers = days.map((day) => day.answers[kind]);
    const done = answers.filter((answer) => answer === ChecklistAnswer.Done).length, skipped = answers.filter((answer) => answer === ChecklistAnswer.Skipped).length;
    return { kind, label: t(`wellness.kinds.${kind}`), summary: t('reports.wellness.answers', { done, skipped }), recorded: done + skipped };
  });
}
