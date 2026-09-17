import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { DailyDigestData } from '@/lib/api/endpoints';

interface Props { data: DailyDigestData }
export function DailyDigestCard({ data }: Props) {
  const { t, locale } = useI18n();
  if (!('version' in data)) return <div className="space-y-2 text-sm">
    <p>{t('notifications.digest.legacy')}</p>
    {data.insights.yesterdayNetPiastres ? <p>{t('notifications.digest.recordedYesterday', { amount: formatMoney(data.insights.yesterdayNetPiastres, locale) })}</p> : null}
  </div>;
  const value = data.insights;
  const hour = value.bestStartHour ? new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, value.bestStartHour.hour))) : '';
  const hasComparison = value.bestStartHour || value.highestAppTotal || value.lowerAreaRate;
  return <div className="space-y-3 text-sm">
    <p className="text-muted-foreground">{t('notifications.digest.captured', { date: data.snapshotDate })}</p>
    {value.todayTargetPiastres !== null ? <div className="space-y-1 rounded-lg border p-3">
      <p>{t('notifications.digest.goalTarget')}</p><p className="text-lg font-semibold num-tabular">{formatMoney(value.todayTargetPiastres, locale)}</p>
      {value.goalTargetPiastres !== null && value.earnedBeforeTodayPiastres !== null && value.remainingGoalDays !== null ? <p className="text-muted-foreground">{t('notifications.digest.goalContext', {
        start: value.goalStartDate ?? '', end: value.goalEndDate ?? '', earned: formatMoney(value.earnedBeforeTodayPiastres, locale),
        goal: formatMoney(value.goalTargetPiastres, locale), days: value.remainingGoalDays,
      })}</p> : null}
    </div> : null}
    {value.yesterdayNetPiastres !== null ? <p>{t('notifications.digest.recordedYesterday', { amount: formatMoney(value.yesterdayNetPiastres, locale) })}</p> : null}
    {value.yesterdayEmptyRatioBp !== null ? <p>{t('notifications.digest.emptyShare', { percentage: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value.yesterdayEmptyRatioBp / 10000) })}</p> : null}
    {hasComparison ? <div className="space-y-2 rounded-lg border p-3">
      <p className="font-medium">{t('notifications.digest.window', { start: data.windowStartDate, end: data.windowEndDate, count: data.sourceTripCount ?? 0 })}</p>
      {value.bestStartHour ? <p>{t('notifications.digest.startHour', { hour, amount: formatMoney(value.bestStartHour.earningsPerTripHourPiastres, locale), count: value.bestStartHour.tripCount })}</p> : null}
      {value.highestAppTotal ? <p>{t('notifications.digest.appTotal', { name: value.highestAppTotal.appName, amount: formatMoney(value.highestAppTotal.earningsPiastres, locale), count: value.highestAppTotal.tripCount })}</p> : null}
      {value.lowerAreaRate ? <p>{t('notifications.digest.areaRate', { name: value.lowerAreaRate.areaName, amount: formatMoney(value.lowerAreaRate.earningsPerPaidKmPiastres, locale), count: value.lowerAreaRate.tripCount })}</p> : null}
      <p className="text-muted-foreground">{t('notifications.digest.comparisonLimits')}</p>
    </div> : null}
    {data.sourceTripCount === null ? <p>{t('notifications.digest.comparisonUnavailable')}</p> : null}
  </div>;
}
