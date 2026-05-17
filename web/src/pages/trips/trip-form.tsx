import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import { readApiError } from '@/lib/api/client';
import {
  AppsApi,
  AreasApi,
  TripsApi,
  VehiclesApi,
  type CreateTripInput,
  type TripItem,
} from '@/lib/api/endpoints';
import { toDatetimeLocalValue } from '@/lib/time';

const schema = z
  .object({
    vehicleId: z.string().min(1),
    driverAppId: z.string().min(1),
    areaId: z.string().optional().nullable(),
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    grossEgp: z.coerce.number().min(0),
    receivedEgp: z.coerce.number().min(0).optional(),
    tipEgp: z.coerce.number().min(0).default(0),
    commissionEgp: z.coerce.number().min(0).default(0),
    tollEgp: z.coerce.number().min(0).default(0),
    parkingEgp: z.coerce.number().min(0).default(0),
    totalKm: z.coerce.number().min(0),
    paidKm: z.coerce.number().min(0),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine((v) => new Date(v.endedAt) > new Date(v.startedAt), {
    path: ['endedAt'],
    message: 'end-before-start',
  })
  .refine((v) => v.paidKm <= v.totalKm, {
    path: ['paidKm'],
    message: 'paid-exceeds-total',
  });

type FormValues = z.input<typeof schema>;

const egpToPiastres = (egp: number) => Math.round(egp * 100);
const piastresToEgp = (p: number) => p / 100;

interface Props {
  trip?: TripItem | null;
  onDone: (id: string) => void;
}

export function TripForm({ trip, onDone }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const appsQ = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: AreasApi.list });

  const defaultValues = useMemo<FormValues>(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (trip) {
      return {
        vehicleId: trip.vehicleId,
        driverAppId: trip.driverAppId,
        areaId: trip.areaId ?? '',
        startedAt: toDatetimeLocalValue(new Date(trip.startedAt)),
        endedAt: toDatetimeLocalValue(new Date(trip.endedAt)),
        grossEgp: piastresToEgp(trip.grossPiastres),
        receivedEgp: piastresToEgp(trip.grossPiastres - trip.commissionPiastres),
        tipEgp: piastresToEgp(trip.tipPiastres),
        commissionEgp: piastresToEgp(trip.commissionPiastres),
        tollEgp: piastresToEgp(trip.tollPiastres ?? 0),
        parkingEgp: piastresToEgp(trip.parkingPiastres ?? 0),
        totalKm: trip.totalKmMeters / 1000,
        paidKm: trip.paidKmMeters / 1000,
        notes: trip.notes ?? '',
      };
    }
    return {
      vehicleId: '',
      driverAppId: '',
      areaId: '',
      startedAt: toDatetimeLocalValue(oneHourAgo),
      endedAt: toDatetimeLocalValue(now),
      grossEgp: 0,
      receivedEgp: undefined,
      tipEgp: 0,
      commissionEgp: 0,
      tollEgp: 0,
      parkingEgp: 0,
      totalKm: 0,
      paidKm: 0,
      notes: '',
    };
  }, [trip]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Auto-default vehicle and app if missing
  useEffect(() => {
    if (!watch('vehicleId') && vehiclesQ.data?.[0]) {
      setValue('vehicleId', vehiclesQ.data[0].id);
    }
    if (!watch('driverAppId') && appsQ.data?.[0]) {
      setValue('driverAppId', appsQ.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiclesQ.data, appsQ.data]);

  const createMut = useMutation({
    mutationFn: (body: CreateTripInput) => TripsApi.create(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['score'] });
      onDone(created.id);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateTripInput> }) =>
      TripsApi.update(id, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['score'] });
      qc.invalidateQueries({ queryKey: ['trip', updated.id] });
      onDone(updated.id);
    },
  });

  const submit = handleSubmit(async (v) => {
    const body: CreateTripInput = {
      vehicleId: v.vehicleId,
      driverAppId: v.driverAppId,
      areaId: v.areaId || undefined,
      startedAt: new Date(v.startedAt).toISOString(),
      endedAt: new Date(v.endedAt).toISOString(),
      grossPiastres: egpToPiastres(Number(v.grossEgp || 0)),
      receivedPiastres:
        v.receivedEgp != null && v.receivedEgp !== ('' as unknown as number)
          ? egpToPiastres(Number(v.receivedEgp))
          : undefined,
      tipPiastres: egpToPiastres(Number(v.tipEgp || 0)),
      commissionPiastres: egpToPiastres(Number(v.commissionEgp || 0)),
      tollPiastres: egpToPiastres(Number(v.tollEgp || 0)),
      parkingPiastres: egpToPiastres(Number(v.parkingEgp || 0)),
      totalKmMeters: Math.round(Number(v.totalKm || 0) * 1000),
      paidKmMeters: Math.round(Number(v.paidKm || 0) * 1000),
      notes: v.notes?.trim() || null,
    };
    try {
      if (trip) {
        await updateMut.mutateAsync({ id: trip.id, body });
      } else {
        await createMut.mutateAsync(body);
      }
    } catch (err) {
      // Surface server-side error inline via banner alert (kept minimal here)
      // eslint-disable-next-line no-console
      console.warn('Trip submit failed', readApiError(err));
    }
  });

  const noVehicles = !vehiclesQ.isLoading && (vehiclesQ.data?.length ?? 0) === 0;
  const noApps = !appsQ.isLoading && (appsQ.data?.length ?? 0) === 0;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {noVehicles ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {t('trips.selectVehicleFirst')}
        </p>
      ) : null}
      {noApps ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {t('trips.selectAppFirst')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vehicleId">{t('trips.field.vehicle')}</Label>
          <Select id="vehicleId" {...register('vehicleId')} invalid={!!errors.vehicleId} disabled={noVehicles}>
            <option value="" disabled>—</option>
            {vehiclesQ.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.make, v.model, v.year].filter(Boolean).join(' ') || v.type}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="driverAppId">{t('trips.field.app')}</Label>
          <Select id="driverAppId" {...register('driverAppId')} invalid={!!errors.driverAppId} disabled={noApps}>
            <option value="" disabled>—</option>
            {appsQ.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.customName ?? a.appSource?.name ?? '—'}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="areaId">
            {t('trips.field.area')} <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
          </Label>
          <Select id="areaId" {...register('areaId')}>
            <option value="">—</option>
            {areasQ.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div />

        <div className="space-y-1.5">
          <Label htmlFor="startedAt">{t('trips.field.startedAt')}</Label>
          <Input id="startedAt" type="datetime-local" {...register('startedAt')} invalid={!!errors.startedAt} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endedAt">{t('trips.field.endedAt')}</Label>
          <Input id="endedAt" type="datetime-local" {...register('endedAt')} invalid={!!errors.endedAt} />
          {errors.endedAt?.message === 'end-before-start' ? (
            <p className="text-xs text-destructive">{t('trips.errors.endBeforeStart')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="grossEgp">{t('trips.field.gross')}</Label>
          <Input
            id="grossEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            {...register('grossEgp')}
            invalid={!!errors.grossEgp}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receivedEgp">
            {t('trips.field.received')} <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
          </Label>
          <Input
            id="receivedEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            {...register('receivedEgp')}
          />
          <p className="text-xs text-muted-foreground">{t('trips.hint.received')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipEgp">{t('trips.field.tip')}</Label>
          <Input id="tipEgp" type="number" inputMode="decimal" step="0.01" min={0} dir="ltr" {...register('tipEgp')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commissionEgp">{t('trips.field.commission')}</Label>
          <Input
            id="commissionEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            {...register('commissionEgp')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="totalKm">{t('trips.field.totalKm')}</Label>
          <Input
            id="totalKm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            dir="ltr"
            {...register('totalKm')}
            invalid={!!errors.totalKm}
          />
          <p className="text-xs text-muted-foreground">{t('trips.hint.totalKm')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paidKm">{t('trips.field.paidKm')}</Label>
          <Input
            id="paidKm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            dir="ltr"
            {...register('paidKm')}
            invalid={!!errors.paidKm}
          />
          <p className="text-xs text-muted-foreground">{t('trips.hint.paidKm')}</p>
          {errors.paidKm?.message === 'paid-exceeds-total' ? (
            <p className="text-xs text-destructive">{t('trips.errors.paidExceedsTotal')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">{t('trips.field.notes')}</Label>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting || createMut.isPending || updateMut.isPending}>
          {isSubmitting ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}
