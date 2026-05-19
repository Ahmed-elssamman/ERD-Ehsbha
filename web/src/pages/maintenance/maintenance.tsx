import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { MaintenanceApi } from '@/lib/api/endpoints';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { toDateInputValue } from '@/lib/time';
import { useVehicleSelector, vehicleLabel } from '@/hooks/use-vehicle-selector';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  GREEN: 'bg-success/15 text-success',
  AMBER: 'bg-warning/15 text-warning',
  RED: 'bg-destructive/15 text-destructive',
  OVERDUE: 'bg-destructive text-destructive-foreground',
};

const recordSchema = z.object({
  maintenanceItemId: z.string().min(1),
  performedAt: z.string().min(1),
  odometerKm: z.coerce.number().min(0),
  costEgp: z.coerce.number().min(0),
  notes: z.string().max(500).optional(),
});
type RecordForm = z.input<typeof recordSchema>;

export function MaintenancePage() {
  const { t, locale } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const { vehicles, selectedId, setSelectedId, selected, isLoading: vehLoading } = useVehicleSelector();
  const [openLog, setOpenLog] = useState(false);

  const riskQ = useQuery({
    queryKey: ['maintenance', 'risk', selectedId],
    queryFn: () => MaintenanceApi.risk(selectedId),
    enabled: !!selectedId,
  });

  const recordsQ = useQuery({
    queryKey: ['maintenance', 'records', selectedId],
    queryFn: () => MaintenanceApi.records(selectedId),
    enabled: !!selectedId,
  });

  if (!vehLoading && vehicles.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title={t('maintenance.title')} subtitle={t('maintenance.subtitle')} />
        <EmptyState Icon={Wrench} title={t('maintenance.addVehicleFirst')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('maintenance.title')}
        subtitle={t('maintenance.subtitle')}
        actions={
          <>
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
            <Button onClick={() => setOpenLog(true)} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden /> {t('maintenance.addRecord')}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('maintenance.riskTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {riskQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !riskQ.data || riskQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {riskQ.data.map((row, i) => (
                <motion.li
                  key={row.item.id}
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16, delay: i * 0.03 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{itemLabel(row.item)}</span>
                      <Badge className={cn(STATUS_STYLES[row.status])}>
                        {t(`maintenance.status.${row.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.lastServiceAt
                        ? `${formatKm(row.kmSinceLastMeters, locale)} ${t('maintenance.kmSince')}${row.daysSinceLast != null ? ` · ${formatNumber(row.daysSinceLast, locale)} ${t('maintenance.daysSince')}` : ''}`
                        : t('maintenance.neverServiced')}
                    </p>
                  </div>
                  <div className="num-tabular text-sm font-semibold tabular-nums">{Math.round(row.risk)}%</div>
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('maintenance.history')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordsQ.isLoading ? (
            <ul className="divide-y divide-border/60">
              {[0, 1].map((i) => (
                <li key={i} className="p-5">
                  <Skeleton className="h-10 w-full" />
                </li>
              ))}
            </ul>
          ) : !recordsQ.data || recordsQ.data.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t('common.noData')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recordsQ.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium">{itemLabel(r.maintenanceItem) || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.performedAt, locale)} · {formatKm(Number(r.odometerMeters), locale)} km
                    </p>
                  </div>
                  <span className="num-tabular text-sm font-semibold">{formatMoney(r.costPiastres, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RecordDialog
        open={openLog}
        onClose={() => setOpenLog(false)}
        vehicleId={selectedId}
        currentOdoKm={selected ? Math.floor(selected.odometerMeters / 1000) : 0}
      />
    </div>
  );
}

function RecordDialog({
  open,
  onClose,
  vehicleId,
  currentOdoKm,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
  currentOdoKm: number;
}) {
  const { t } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const qc = useQueryClient();
  const itemsQ = useQuery({ queryKey: ['maintenance', 'items'], queryFn: MaintenanceApi.items, enabled: open });

  const defaults: RecordForm = {
    maintenanceItemId: '',
    performedAt: toDateInputValue(new Date()),
    odometerKm: currentOdoKm,
    costEgp: 0,
    notes: '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordForm>({ resolver: zodResolver(recordSchema), defaultValues: defaults });

  const addMut = useMutation({
    mutationFn: (body: { maintenanceItemId: string; performedAt: string; odometerMeters: number; costPiastres: number; notes?: string | null }) =>
      MaintenanceApi.addRecord(vehicleId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      reset({ ...defaults, odometerKm: currentOdoKm });
      onClose();
    },
  });

  const submit = handleSubmit((v) =>
    addMut.mutateAsync({
      maintenanceItemId: v.maintenanceItemId,
      performedAt: new Date(v.performedAt).toISOString(),
      odometerMeters: Math.round(Number(v.odometerKm) * 1000),
      costPiastres: Math.round(Number(v.costEgp) * 100),
      notes: v.notes?.trim() || null,
    }),
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset(defaults);
        onClose();
      }}
      title={t('maintenance.addRecord')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || addMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="maintenanceItemId">{t('maintenance.field.item')}</Label>
            <Select id="maintenanceItemId" {...register('maintenanceItemId')} invalid={!!errors.maintenanceItemId}>
              <option value="" disabled>—</option>
              {itemsQ.data
                ?.slice()
                .sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)))
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {itemLabel(it)}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="performedAt">{t('maintenance.field.performedAt')}</Label>
            <Input id="performedAt" type="date" {...register('performedAt')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="odometerKm">{t('maintenance.field.odometer')}</Label>
            <Input id="odometerKm" type="number" step="1" min={0} dir="ltr" {...register('odometerKm')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="costEgp">{t('maintenance.field.cost')}</Label>
            <Input id="costEgp" type="number" step="0.01" min={0} dir="ltr" {...register('costEgp')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">{t('maintenance.field.notes')}</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
