import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { formatMoney, formatDate, formatNumber, formatKm } from '@/lib/format';
import { ReportsApi } from './reports.api';
import { reportErrorKey, reviseReportContext } from './report-draft.control';
import { reportMetrics, reportObservations, reportRangeLabel, reportSummaryView } from './reports.control';
import { ReportEditor } from './report-editor';
import { ReportWellness } from './report-wellness';

export function ReportDetailPage() {
  const { id = '', version = '' } = useParams(), { t, tf, locale } = useI18n();
  const [revising, setRevising] = useState(false), [showHistory, setShowHistory] = useState(false);
  const report = useQuery({ queryKey: ['reports', id, version], queryFn: () => version ? ReportsApi.revision(id, Number(version)) : ReportsApi.get(id), retry: false, networkMode: 'always', staleTime: 0 });
  const history = useInfiniteQuery({ queryKey: ['reports', id, 'history'], initialPageParam: '', queryFn: ({ pageParam }) => ReportsApi.history(id, pageParam), getNextPageParam: (last) => last.nextCursor, enabled: showHistory, retry: false, networkMode: 'always' });
  function retry() { void report.refetch(); }
  function closeRevision() { setRevising(false); }
  function revise() { setRevising(true); }
  function openHistory() { setShowHistory(true); }
  function retryHistory() { void history.refetch(); }
  function moreHistory() { void history.fetchNextPage(); }
  const saved = report.data;
  if (!saved) return <div className="space-y-4"><Link to="/reports" className="inline-flex min-h-11 items-center underline">{t('reports.back')}</Link>
    {report.isError ? <div role="alert" className="space-y-2"><p>{t(reportErrorKey(report.error))}</p><Button onClick={retry}>{t('common.retry')}</Button></div> : <p role="status">{t('common.loading')}</p>}</div>;
  const content = saved.content, totals = content.totals, summary = reportSummaryView(saved, locale, t), metrics = reportMetrics(content, locale, t), observations = reportObservations(content, locale, t);
  const days = content.days.map((day) => ({ date: day.date, label: formatDate(`${day.date}T12:00:00Z`, locale), trips: formatNumber(day.totals.tripCount, locale),
    net: day.recorded ? formatMoney(day.totals.netPiastres, locale) : t('reports.unrecordedDay'), costs: day.recorded ? formatMoney(day.totals.totalCostsPiastres, locale) : '—' }));
  const platforms = content.platforms?.map((item) => ({ ...item, count: formatNumber(item.tripCount, locale), contribution: formatMoney(item.contributionPiastres, locale),
    perKm: item.contributionPerKmPiastres === null ? t('reports.unavailable') : formatMoney(item.contributionPerKmPiastres, locale), distance: t('reports.km', { value: formatKm(item.totalKmMeters, locale) }) }));
  const vehicles = content.vehicleCosts?.map((item) => ({ ...item, name: tf(`settings.vehicleType.${item.name}`, item.name), amount: formatMoney(item.totalPiastres, locale), count: t('reports.costRecords', { count: item.recordCount }) }));
  const largest = content.largestCosts.map((cost) => ({ key: `${cost.kind}:${cost.id}`, label: t(`reports.costKinds.${cost.kind}`), date: formatDate(`${cost.date}T12:00:00Z`, locale), amount: formatMoney(cost.amountPiastres, locale) }));
  const revisions = [...new Map((history.data?.pages.flatMap((page) => page.items) ?? []).map((row) => [row.version, row])).values()].map((row) => reportSummaryView(row, locale, t));
  const priorRange = reportRangeLabel(content.previous, locale, t);
  const grossCoverage = t('reports.grossCoverage', { known: totals.grossKnownTripCount, count: totals.tripCount, amount: formatMoney(totals.knownGrossPiastres, locale) });
  const commissionCoverage = t('reports.commissionCoverage', { known: totals.commissionKnownTripCount, count: totals.tripCount, amount: formatMoney(totals.knownCommissionPiastres, locale) });
  const fuelSummary = t('reports.fuelSummary', { count: content.fuelPurchaseCount, amount: formatMoney(content.fuelPurchasesPiastres, locale) });
  const maintenanceSummary = t('reports.maintenanceSummary', { count: content.maintenanceServiceCount, amount: formatMoney(content.maintenanceServicesPiastres, locale) });
  const unassigned = t('reports.unassigned', { amount: formatMoney(content.unassignedCostsPiastres, locale) });
  return <article className="space-y-6">
    <Link to="/reports" className="inline-flex min-h-11 items-center text-sm underline">{t('reports.back')}</Link>
    <PageHeader title={summary.periodLabel} subtitle={summary.rangeLabel} actions={<Button variant="outline" className="min-h-11" onClick={revise}>{t('reports.revise')}</Button>} />
    <p className="text-sm text-muted-foreground">{summary.captureLabel}</p><p className="text-sm">{t('reports.snapshotHelp')}</p>
    {report.isError ? <div role="alert" className="space-y-2"><p>{t('reports.cached')}</p><Button variant="outline" onClick={retry}>{t('common.retry')}</Button></div> : null}
    {!totals.recordedDays ? <p role="status" className="rounded-xl border p-4">{t('reports.noActivity')}</p> : null}
    <section aria-label={t('reports.totals')} className="space-y-3">
      <h2 className="font-semibold">{t('reports.totals')}</h2><p className="text-sm text-muted-foreground">{t('reports.previousRange', { range: priorRange })}</p>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">{metrics.map((metric) => <div key={metric.key} className="min-w-0 border-s-2 ps-3">
        <dt className="text-sm text-muted-foreground">{metric.label}</dt><dd className="break-words text-xl font-semibold tabular-nums">{metric.value}</dd><dd className="mt-1 text-xs text-muted-foreground">{t('reports.previousValue', { value: metric.previous })}</dd>
      </div>)}</dl>
      <p className="text-sm text-muted-foreground">{t('reports.cashBasis')}</p><p className="text-sm text-muted-foreground">{t('reports.ratiosHelp')}</p>
      {totals.grossPiastres === null ? <p className="text-sm">{grossCoverage}</p> : null}{totals.commissionPiastres === null ? <p className="text-sm">{commissionCoverage}</p> : null}
    </section>
    {observations.length ? <section className="space-y-2 border-t pt-5"><h2 className="font-semibold">{t('reports.observations')}</h2><ul className="list-disc space-y-2 ps-5 text-sm">{observations.map((text) => <li key={text}>{text}</li>)}</ul></section> : null}
    <details className="space-y-3 border-t pt-5"><summary className="min-h-11 cursor-pointer font-semibold">{t('reports.trend')}</summary><p className="text-sm text-muted-foreground">{t('reports.trendHelp')}</p>
      <div className="overflow-x-auto"><table className="w-full text-start text-sm"><caption className="sr-only">{t('reports.trend')}</caption><thead><tr className="border-b">
        <th scope="col" className="p-2 text-start">{t('reports.day')}</th><th scope="col" className="p-2 text-start">{t('reports.trips')}</th><th scope="col" className="p-2 text-start">{t('reports.net')}</th><th scope="col" className="p-2 text-start">{t('reports.costs')}</th>
      </tr></thead><tbody>{days.map((day) => <tr key={day.date} className="border-b"><th scope="row" className="p-2 text-start font-normal">{day.label}</th><td className="p-2">{day.trips}</td><td className="p-2">{day.net}</td><td className="p-2">{day.costs}</td></tr>)}</tbody></table></div>
    </details>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{t('reports.platforms')}</h2><p className="text-sm text-muted-foreground">{t('reports.platformBasis')}</p>
      {platforms === null || !platforms ? <p>{t('reports.groupLimit')}</p> : !platforms.length ? <p>{t('reports.noPlatforms')}</p> : <ul className="divide-y">{platforms.map((item) => <li key={item.id} className="space-y-2 py-3">
        <h3 className="break-words font-medium">{item.name}</h3><p className="text-sm">{t('reports.platformCount', { count: item.count, distance: item.distance })}</p><p className="text-sm">{t('reports.platformContribution', { amount: item.contribution, rate: item.perKm })}</p>
      </li>)}</ul>}
    </section>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{t('reports.vehicleCosts')}</h2><p className="text-sm text-muted-foreground">{t('reports.vehicleBasis')}</p>
      {vehicles === null || !vehicles ? <p>{t('reports.groupLimit')}</p> : !vehicles.length ? <p>{t('reports.noVehicleCosts')}</p> : <ul className="divide-y">{vehicles.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="break-words font-medium">{item.name}</p><p>{item.count}</p></div><p>{item.amount}</p></li>)}</ul>}
      <p className="text-sm">{unassigned}</p><p className="text-sm">{fuelSummary}</p><p className="text-sm">{maintenanceSummary}</p><p className="text-sm text-muted-foreground">{t('reports.linkedCosts')}</p>
    </section>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{t('reports.largest')}</h2>{largest.length ? <ol className="divide-y">{largest.map((cost) => <li key={cost.key} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p>{cost.label}</p><p className="text-muted-foreground">{cost.date}</p></div><p>{cost.amount}</p></li>)}</ol> : <p>{t('reports.noCosts')}</p>}</section>
    <ReportWellness startsOn={saved.startsOn} endsOn={saved.endsOn} />
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{t('reports.history')}</h2>
      {!showHistory ? <Button variant="outline" className="min-h-11" onClick={openHistory}>{t('reports.showHistory')}</Button> : <>
        {history.isPending ? <p role="status">{t('common.loading')}</p> : null}
        {history.isError ? <div role="alert" className="space-y-2"><p>{t('reports.historyFailed')}</p><Button variant="outline" onClick={retryHistory}>{t('common.retry')}</Button></div> : null}
        <ul>{revisions.map((row) => <li key={row.version}><Link to={row.href} className="inline-flex min-h-11 items-center text-sm underline">{row.captureLabel}</Link></li>)}</ul>
        {history.hasNextPage ? <Button variant="outline" onClick={moreHistory} loading={history.isFetchingNextPage}>{t('reports.more')}</Button> : null}
      </>}
      <Link to={`/reports/${id}`} className="inline-flex min-h-11 items-center text-sm underline">{t('reports.current')}</Link>
    </section>
    {revising ? <ReportEditor context={reviseReportContext(saved)} scope={`revise:${saved.id}`} onClose={closeRevision} /> : null}
  </article>;
}
