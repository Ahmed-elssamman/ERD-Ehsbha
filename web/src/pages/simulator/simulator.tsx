import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { VehiclesApi } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/format';

interface Inputs {
  grossEgp: number;
  km: number;
  hours: number;
  daysPerMonth: number;
  commissionPct: number;
  fuelPerKmEgp: number;
  otherPerKmEgp: number;
}

const DEFAULT: Inputs = {
  grossEgp: 0,
  km: 0,
  hours: 0,
  daysPerMonth: 0,
  commissionPct: 0,
  fuelPerKmEgp: 0,
  otherPerKmEgp: 0,
};

export function ProfitSimulatorPage() {
  const { t, locale } = useI18n();
  const [inputs, setInputs] = useState<Inputs>(DEFAULT);

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const firstVehicle = vehiclesQ.data?.[0];
  const summaryQ = useQuery({
    queryKey: ['vehicle', firstVehicle?.id, 'cost-summary'],
    queryFn: () => VehiclesApi.costSummary(firstVehicle!.id),
    enabled: !!firstVehicle,
  });

  const result = useMemo(() => {
    const grossDaily = inputs.grossEgp;
    const commission = grossDaily * (inputs.commissionPct / 100);
    const fuelDaily = inputs.fuelPerKmEgp * inputs.km;
    const otherDaily = inputs.otherPerKmEgp * inputs.km;
    const netDaily = grossDaily - commission - fuelDaily - otherDaily;
    const netMonthly = netDaily * inputs.daysPerMonth;
    const netPerKm = inputs.km > 0 ? netDaily / inputs.km : 0;
    const netPerHour = inputs.hours > 0 ? netDaily / inputs.hours : 0;
    return {
      netDaily,
      netMonthly,
      netPerKm,
      netPerHour,
      commissionDaily: commission,
      fuelDaily,
      otherDaily,
    };
  }, [inputs]);

  const set = <K extends keyof Inputs>(k: K) => (v: string) => {
    const num = Number(v);
    setInputs((cur) => ({ ...cur, [k]: Number.isFinite(num) ? num : 0 }));
  };

  const fillFromVehicle = () => {
    if (!summaryQ.data) return;
    const totalPerKm = summaryQ.data.totalPerKmPiastres / 100;
    const fuelShare = summaryQ.data.components.find((c) => c.key.toLowerCase().includes('fuel'));
    const fuelPerKm = fuelShare ? fuelShare.perKmPiastres / 100 : 0;
    setInputs((cur) => ({
      ...cur,
      fuelPerKmEgp: Number(fuelPerKm.toFixed(2)),
      otherPerKmEgp: Number(Math.max(0, totalPerKm - fuelPerKm).toFixed(2)),
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('simulator.title')}
        subtitle={t('simulator.subtitle')}
        actions={
          summaryQ.data ? (
            <Button variant="outline" onClick={fillFromVehicle} className="gap-2">
              <Sparkles className="h-4 w-4" /> {t('simulator.fillFromVehicle')}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" aria-hidden /> {t('simulator.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={t('simulator.expectedGross')}
              value={inputs.grossEgp}
              onChange={set('grossEgp')}
              step={10}
            />
            <Field
              label={t('simulator.expectedKm')}
              value={inputs.km}
              onChange={set('km')}
              step={5}
            />
            <Field
              label={t('simulator.expectedHours')}
              value={inputs.hours}
              onChange={set('hours')}
              step={0.5}
            />
            <Field
              label={t('simulator.expectedDays')}
              value={inputs.daysPerMonth}
              onChange={set('daysPerMonth')}
              step={1}
            />
            <Field
              label={t('simulator.commission')}
              value={inputs.commissionPct}
              onChange={set('commissionPct')}
              step={1}
            />
            <Field
              label={t('simulator.fuelCostPerKm')}
              value={inputs.fuelPerKmEgp}
              onChange={set('fuelPerKmEgp')}
              step={0.05}
            />
            <Field
              label={t('simulator.otherCostPerKm')}
              value={inputs.otherPerKmEgp}
              onChange={set('otherPerKmEgp')}
              step={0.05}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{t('simulator.estNet')}</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.p
                key={result.netMonthly}
                initial={{ scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="num-tabular text-4xl font-bold tracking-tight gradient-text"
              >
                {formatMoney(Math.round(result.netMonthly * 100), locale)}
              </motion.p>
              <p className="mt-2 text-xs text-muted-foreground">/ {t('common.thisMonth')}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <ResultCard label={t('simulator.estPerKm')} value={formatMoney(Math.round(result.netPerKm * 100), locale)} />
            <ResultCard label={t('simulator.estPerHour')} value={formatMoney(Math.round(result.netPerHour * 100), locale)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('expenses.byCategory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Breakdown
                label={t('trips.field.commission')}
                value={result.commissionDaily}
                total={inputs.grossEgp}
              />
              <Breakdown
                label={t('simulator.fuelCostPerKm')}
                value={result.fuelDaily}
                total={inputs.grossEgp}
              />
              <Breakdown
                label={t('simulator.otherCostPerKm')}
                value={result.otherDaily}
                total={inputs.grossEgp}
              />
              <Breakdown
                label={t('dashboard.netProfit')}
                value={result.netDaily}
                total={inputs.grossEgp}
                tone="success"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: string) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num-tabular mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}

function Breakdown({ label, value, total, tone }: { label: string; value: number; total: number; tone?: 'success' }) {
  const { locale } = useI18n();
  const pct = total > 0 ? (Math.abs(value) / total) * 100 : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`num-tabular ${tone === 'success' ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
          {formatMoney(Math.round(value * 100), locale)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.3 }}
          className={`h-full rounded-full ${tone === 'success' ? 'bg-success' : 'bg-primary/60'}`}
        />
      </div>
    </div>
  );
}
