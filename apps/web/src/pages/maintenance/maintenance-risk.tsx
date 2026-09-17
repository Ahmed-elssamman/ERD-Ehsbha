import { useQuery } from '@tanstack/react-query';
import { MaintenanceApi } from '@/lib/api/endpoints';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { formatDate, formatKm, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MAINTENANCE_DATE_FORMAT, MAINTENANCE_STATUS_STYLES } from './maintenance.control';

export function MaintenanceRisk({ vehicleId }: { vehicleId: string }) {
  const { t, locale } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const query = useQuery({ queryKey: ['maintenance', 'risk', vehicleId], queryFn: () => MaintenanceApi.risk(vehicleId) });
  const rows = (query.data ?? []).map((row) => ({ ...row, label: itemLabel(row.item),
    percent: row.risk === null ? null : formatNumber(Math.round(row.risk * 100), locale) }));
  return <Card><CardHeader><CardTitle>{t('maintenance.riskTitle')}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">{t('maintenance.scheduleGuide')}</p>
    {query.isLoading ? <p role="status">{t('common.loading')}</p> : null}
    {query.isError ? <div role="alert"><p>{t('maintenance.riskFailed')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
    {query.isSuccess && !rows.length ? <p>{t('maintenance.noRiskItems')}</p> : null}
    {rows.map((row) => <article key={row.item.id} className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{row.label}</h3>
        <Badge className={MAINTENANCE_STATUS_STYLES[row.status]}>{t(`maintenance.status.${row.status}`)}{row.percent !== null ? ` · ${row.percent}%` : ''}</Badge></div>
      <p className="text-sm">{row.lastServiceAt ? `${t('maintenance.lastService')}: ${formatDate(row.lastServiceAt, locale, MAINTENANCE_DATE_FORMAT)}` : t('maintenance.noRecordedService')}</p>
      {row.kmSinceLastMeters !== null ? <p className="text-sm">{t('maintenance.distanceSince')}: {formatKm(row.kmSinceLastMeters, locale)}</p> : null}
    </article>)}
  </CardContent></Card>;
}
