import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';

interface Props { fuelPiastres?: number; expensePiastres?: number; maintenancePiastres?: number; retainedMaintenanceEstimatePiastres?: number }
export function OperatingCostSummary({ fuelPiastres, expensePiastres, maintenancePiastres, retainedMaintenanceEstimatePiastres }: Props) {
  const { t, locale } = useI18n();
  return <div className="col-span-full space-y-3 rounded-xl border p-4">
    <p className="text-sm">{t('analytics.cashBasis')}</p>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div><dt className="text-sm text-muted-foreground">{t('analytics.fuelCosts')}</dt><dd className="num-tabular font-medium">{formatMoney(fuelPiastres ?? null, locale)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">{t('expenses.title')}</dt><dd className="num-tabular font-medium">{formatMoney(expensePiastres ?? null, locale)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">{t('analytics.serviceCosts')}</dt><dd className="num-tabular font-medium">{formatMoney(maintenancePiastres ?? null, locale)}</dd></div>
    </dl>
    {retainedMaintenanceEstimatePiastres ? <p className="text-sm text-muted-foreground">{t('analytics.retainedEstimate')}: {formatMoney(retainedMaintenanceEstimatePiastres, locale)}</p> : null}
  </div>;
}
