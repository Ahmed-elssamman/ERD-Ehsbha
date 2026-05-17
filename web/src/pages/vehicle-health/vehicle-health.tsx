import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, HeartPulse, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';
import { VehiclesApi, type Vehicle } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/format';
import { useVehicleSelector, vehicleLabel } from '@/hooks/use-vehicle-selector';

const PALETTE = ['#34D399', '#60A5FA', '#F59E0B', '#F87171', '#A78BFA', '#22D3EE', '#FB7185', '#FACC15'];

const componentLabelKey = (key: string): string => {
  const k = key.toLowerCase();
  if (k.includes('fuel')) return 'vehicleHealth.fields.fuelTankCostPiastres';
  if (k.includes('oil')) return 'vehicleHealth.fields.oilCostPiastres';
  if (k.includes('tire') || k.includes('tyre')) return 'vehicleHealth.fields.tireCostPiastres';
  if (k.includes('brake')) return 'vehicleHealth.fields.brakesCostPiastres';
  if (k.includes('chain')) return 'vehicleHealth.fields.chainCostPiastres';
  if (k.includes('battery')) return 'vehicleHealth.fields.batteryCostPiastres';
  if (k.includes('maint')) return 'vehicleHealth.fields.monthlyMaintCostPiastres';
  return '';
};

export function VehicleHealthPage() {
  const { t, locale } = useI18n();
  const { vehicles, selected, selectedId, setSelectedId, isLoading } = useVehicleSelector();
  const [configureOpen, setConfigureOpen] = useState(false);

  const summaryQ = useQuery({
    queryKey: ['vehicle', selectedId, 'cost-summary'],
    queryFn: () => VehiclesApi.costSummary(selectedId),
    enabled: !!selectedId,
  });

  if (!isLoading && vehicles.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title={t('vehicleHealth.title')} subtitle={t('vehicleHealth.subtitle')} />
        <EmptyState
          Icon={HeartPulse}
          title={t('vehicleHealth.noVehicles')}
          action={
            <Button asChild>
              <Link to="/settings">{t('nav.settings')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const data = summaryQ.data;
  const completenessPct = data ? data.completenessBp / 100 : 0;
  const providedComponents = (data?.components ?? []).filter((c) => c.provided && c.perKmPiastres > 0);
  const hasCosts = providedComponents.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('vehicleHealth.title')}
        subtitle={t('vehicleHealth.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {vehicles.length > 1 ? (
              <Select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="min-w-[12rem]"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button
              onClick={() => setConfigureOpen(true)}
              disabled={!selected}
              className="gap-2"
            >
              <Sliders className="h-4 w-4" aria-hidden /> {t('vehicleHealth.configure')}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" aria-hidden /> {t('vehicleHealth.totalPerKm')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <p className="num-tabular text-3xl font-bold tracking-tight">
                  {formatMoney(data?.totalPerKmPiastres ?? 0, locale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('common.perKm')}</p>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">{t('vehicleHealth.completeness')}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      initial={{ width: 0 }}
                      animate={{ width: `${completenessPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="num-tabular mt-1 text-sm font-semibold">{Math.round(completenessPct)}%</p>
                </div>
                <Button
                  variant="outline"
                  className="mt-5 w-full gap-2"
                  onClick={() => setConfigureOpen(true)}
                  disabled={!selected}
                >
                  <SettingsIcon className="h-4 w-4" /> {t('vehicleHealth.configure')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('vehicleHealth.components')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !hasCosts ? (
              <EmptyState
                Icon={Sliders}
                title={t('vehicleHealth.emptyHint')}
                action={
                  <Button onClick={() => setConfigureOpen(true)} disabled={!selected} className="gap-2">
                    <Sliders className="h-4 w-4" /> {t('vehicleHealth.configure')}
                  </Button>
                }
              />
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-5">
                <div className="h-56 sm:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providedComponents.map((c) => ({ name: c.key, value: c.perKmPiastres }))}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {providedComponents.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          color: 'hsl(var(--card-foreground))',
                        }}
                        formatter={(value: number) => formatMoney(value, locale)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 sm:col-span-3">
                  {providedComponents.map((c, i) => {
                    const labelKey = componentLabelKey(c.key);
                    const label = labelKey ? t(labelKey) : c.key;
                    const sharePct = typeof c.shareBp === 'number' ? c.shareBp / 100 : 0;
                    return (
                      <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: PALETTE[i % PALETTE.length] }}
                            aria-hidden
                          />
                          <span className="truncate font-medium">{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="num-tabular text-muted-foreground">
                            {formatMoney(c.perKmPiastres, locale)} {t('common.perKm')}
                          </span>
                          <span className="num-tabular w-12 text-end text-xs text-muted-foreground">
                            {sharePct.toFixed(0)}%
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <CostsDialog
          open={configureOpen}
          onClose={() => setConfigureOpen(false)}
          vehicle={selected}
        />
      ) : null}
    </div>
  );
}

const optionalIntFromInput = z
  .union([z.string(), z.number()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), { message: 'invalid' });

const costsSchema = z.object({
  fuelTankCostEgp: optionalIntFromInput,
  fuelTankKmRange: optionalIntFromInput,
  oilCostEgp: optionalIntFromInput,
  oilIntervalKm: optionalIntFromInput,
  tireCostEgp: optionalIntFromInput,
  tireIntervalKm: optionalIntFromInput,
  brakesCostEgp: optionalIntFromInput,
  brakesIntervalKm: optionalIntFromInput,
  chainCostEgp: optionalIntFromInput,
  chainIntervalKm: optionalIntFromInput,
  batteryCostEgp: optionalIntFromInput,
  batteryIntervalMonths: optionalIntFromInput,
  monthlyMaintCostEgp: optionalIntFromInput,
  monthlyAvgKm: optionalIntFromInput,
});
type CostsForm = z.input<typeof costsSchema>;

function piastresToEgpString(p: number | null | undefined): string {
  if (p == null) return '';
  return String(Math.round(p / 100));
}

function numOrEmpty(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

function CostsDialog({
  open,
  onClose,
  vehicle,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const initial: CostsForm = {
    fuelTankCostEgp: piastresToEgpString(vehicle.fuelTankCostPiastres),
    fuelTankKmRange: numOrEmpty(vehicle.fuelTankKmRange),
    oilCostEgp: piastresToEgpString(vehicle.oilCostPiastres),
    oilIntervalKm: numOrEmpty(vehicle.oilIntervalKm),
    tireCostEgp: piastresToEgpString(vehicle.tireCostPiastres),
    tireIntervalKm: numOrEmpty(vehicle.tireIntervalKm),
    brakesCostEgp: piastresToEgpString(vehicle.brakesCostPiastres),
    brakesIntervalKm: numOrEmpty(vehicle.brakesIntervalKm),
    chainCostEgp: piastresToEgpString(vehicle.chainCostPiastres),
    chainIntervalKm: numOrEmpty(vehicle.chainIntervalKm),
    batteryCostEgp: piastresToEgpString(vehicle.batteryCostPiastres),
    batteryIntervalMonths: numOrEmpty(vehicle.batteryIntervalMonths),
    monthlyMaintCostEgp: piastresToEgpString(vehicle.monthlyMaintCostPiastres),
    monthlyAvgKm: numOrEmpty(vehicle.monthlyAvgKm),
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CostsForm>({
    resolver: zodResolver(costsSchema),
    defaultValues: initial,
  });

  // Sync form when switching between vehicles while the dialog is mounted
  useEffect(() => {
    reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const saveMut = useMutation({
    mutationFn: (body: Parameters<typeof VehiclesApi.updateCosts>[1]) =>
      VehiclesApi.updateCosts(vehicle.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id, 'cost-summary'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
    },
  });

  const submit = handleSubmit((v) => {
    const egpToPiastres = (val: unknown) =>
      val === null || val === undefined || val === '' ? null : Math.round(Number(val) * 100);
    const intOrNull = (val: unknown) =>
      val === null || val === undefined || val === '' ? null : Math.round(Number(val));

    return saveMut.mutateAsync({
      fuelTankCostPiastres: egpToPiastres(v.fuelTankCostEgp),
      fuelTankKmRange: intOrNull(v.fuelTankKmRange),
      oilCostPiastres: egpToPiastres(v.oilCostEgp),
      oilIntervalKm: intOrNull(v.oilIntervalKm),
      tireCostPiastres: egpToPiastres(v.tireCostEgp),
      tireIntervalKm: intOrNull(v.tireIntervalKm),
      brakesCostPiastres: egpToPiastres(v.brakesCostEgp),
      brakesIntervalKm: intOrNull(v.brakesIntervalKm),
      chainCostPiastres: egpToPiastres(v.chainCostEgp),
      chainIntervalKm: intOrNull(v.chainIntervalKm),
      batteryCostPiastres: egpToPiastres(v.batteryCostEgp),
      batteryIntervalMonths: intOrNull(v.batteryIntervalMonths),
      monthlyMaintCostPiastres: egpToPiastres(v.monthlyMaintCostEgp),
      monthlyAvgKm: intOrNull(v.monthlyAvgKm),
    });
  });

  const isBike = vehicle.type === 'BIKE';

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset(initial);
        onClose();
      }}
      title={t('vehicleHealth.configureTitle')}
      description={t('vehicleHealth.configureSubtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || saveMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Section title={t('vehicleHealth.fields.fuelTankCostPiastres')}>
          <NumField id="fuelTankCostEgp" label={t('vehicleHealth.fields.fuelTankCostPiastres')} registration={register('fuelTankCostEgp')} />
          <NumField id="fuelTankKmRange" label={t('vehicleHealth.fields.fuelTankKmRange')} registration={register('fuelTankKmRange')} />
        </Section>

        <Section title={t('vehicleHealth.fields.oilCostPiastres')}>
          <NumField id="oilCostEgp" label={t('vehicleHealth.fields.oilCostPiastres')} registration={register('oilCostEgp')} />
          <NumField id="oilIntervalKm" label={t('vehicleHealth.fields.oilIntervalKm')} registration={register('oilIntervalKm')} />
        </Section>

        <Section title={t('vehicleHealth.fields.tireCostPiastres')}>
          <NumField id="tireCostEgp" label={t('vehicleHealth.fields.tireCostPiastres')} registration={register('tireCostEgp')} />
          <NumField id="tireIntervalKm" label={t('vehicleHealth.fields.tireIntervalKm')} registration={register('tireIntervalKm')} />
        </Section>

        <Section title={t('vehicleHealth.fields.brakesCostPiastres')}>
          <NumField id="brakesCostEgp" label={t('vehicleHealth.fields.brakesCostPiastres')} registration={register('brakesCostEgp')} />
          <NumField id="brakesIntervalKm" label={t('vehicleHealth.fields.brakesIntervalKm')} registration={register('brakesIntervalKm')} />
        </Section>

        {isBike ? (
          <Section title={t('vehicleHealth.fields.chainCostPiastres')}>
            <NumField id="chainCostEgp" label={t('vehicleHealth.fields.chainCostPiastres')} registration={register('chainCostEgp')} />
            <NumField id="chainIntervalKm" label={t('vehicleHealth.fields.chainIntervalKm')} registration={register('chainIntervalKm')} />
          </Section>
        ) : null}

        <Section title={t('vehicleHealth.fields.batteryCostPiastres')}>
          <NumField id="batteryCostEgp" label={t('vehicleHealth.fields.batteryCostPiastres')} registration={register('batteryCostEgp')} />
          <NumField id="batteryIntervalMonths" label={t('vehicleHealth.fields.batteryIntervalMonths')} registration={register('batteryIntervalMonths')} />
        </Section>

        <Section title={t('vehicleHealth.fields.monthlyMaintCostPiastres')}>
          <NumField id="monthlyMaintCostEgp" label={t('vehicleHealth.fields.monthlyMaintCostPiastres')} registration={register('monthlyMaintCostEgp')} />
          <NumField id="monthlyAvgKm" label={t('vehicleHealth.fields.monthlyAvgKm')} registration={register('monthlyAvgKm')} />
        </Section>
      </form>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function NumField({
  id,
  label,
  registration,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min={0} step={1} dir="ltr" {...registration} />
    </div>
  );
}
