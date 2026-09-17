import { useQuery } from '@tanstack/react-query';
import { FuelApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { FUEL_DATE_FORMAT } from './fuel.control';

interface Props { vehicleId: string; from: string; to: string }
export function FuelEfficiency({ vehicleId, from, to }: Props) {
  const { t, locale } = useI18n();
  const query = useQuery({ queryKey: ['fuel', 'efficiency', vehicleId, from, to], queryFn: () => FuelApi.efficiency({ vehicleId, from, to }) });
  const result = query.data;
  return <section className="space-y-3 rounded-xl border p-4" aria-labelledby="fuel-economy-title">
    <h2 id="fuel-economy-title" className="font-semibold">{t('fuel.efficiency.title')}</h2>
    <p className="text-sm text-muted-foreground">{t('fuel.efficiency.method')}</p>
    {query.isLoading ? <p role="status">{t('common.loading')}</p> : query.isError ? <div role="alert"><p>{t('fuel.efficiency.failed')}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : result ? <>
      {result.truncated ? <p>{t('fuel.efficiency.tooMany')}</p> : result.kmPerLiter === null ? <p>{t('fuel.efficiency.insufficient')}</p> : <>
        <dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">{t('fuel.efficiency.kmPerLiter')}</dt><dd className="text-lg font-semibold">{formatNumber(result.kmPerLiter, locale, 2)}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{t('fuel.efficiency.litersPer100')}</dt><dd className="text-lg font-semibold">{result.litersPer100Km === null ? t('fuel.missing') : formatNumber(result.litersPer100Km, locale, 2)}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{t('fuel.efficiency.costPerKm')}</dt><dd className="text-lg font-semibold">{result.costPerKmPiastres === null ? t('fuel.missing') : formatMoney(result.costPerKmPiastres, locale)}</dd></div></dl>
        <p className="text-sm">{t('fuel.efficiency.cycles')}: {formatNumber(result.cycleCount, locale)} · {formatKm(result.distanceMeters, locale, 3)} {t('units.km')} · {formatNumber(result.quantityLiters, locale, 3)} {t('fuel.unit.LITER')}</p>
        {result.from && result.to ? <p className="text-sm">{formatDate(result.from, locale, FUEL_DATE_FORMAT)} — {formatDate(result.to, locale, FUEL_DATE_FORMAT)}</p> : null}
      </>}
      {!result.truncated && result.issues.length ? <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{result.issues.map((issue) => <li key={issue}>{t(`fuel.efficiency.issue.${issue}`)}</li>)}</ul> : null}
    </> : null}
  </section>;
}
