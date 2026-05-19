import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OcrPlatform } from '@/lib/api/ocr.api';
import { deriveClientMutationId, type PrefilledFormValues } from '@/lib/ocr/parsed-to-form';
import { OcrConfidenceBadge } from '@/components/ocr/ocr-confidence-badge';
import { OcrWarningList } from '@/components/ocr/ocr-warning-list';

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
    commissionAuto: z.boolean().default(true),
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

export interface OcrPrefill {
  values: PrefilledFormValues;
  confidences: Record<string, number>;
  imageHashes: string[];
  platform: OcrPlatform | null;
  warnings: string[];
}

interface Props {
  trip?: TripItem | null;
  onDone: (id: string) => void;
  initialFromOcr?: OcrPrefill | null;
}

const OCR_TO_FIELD: Record<string, keyof FormValues> = {
  grossEgp: 'grossEgp',
  receivedEgp: 'receivedEgp',
  tipEgp: 'tipEgp',
  commissionEgp: 'commissionEgp',
  tollEgp: 'tollEgp',
  parkingEgp: 'parkingEgp',
  totalKm: 'totalKm',
  paidKm: 'paidKm',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
};

function fieldConfidence(ocr: OcrPrefill | null | undefined, field: keyof FormValues): number | null {
  if (!ocr) return null;
  for (const [src, dst] of Object.entries(OCR_TO_FIELD)) {
    if (dst === field) {
      const v = ocr.confidences[src];
      return typeof v === 'number' ? v : null;
    }
  }
  return null;
}

export function TripForm({ trip, onDone, initialFromOcr }: Props) {
  const { t, locale } = useI18n();
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
        commissionAuto: false,
        tollEgp: piastresToEgp(trip.tollPiastres ?? 0),
        parkingEgp: piastresToEgp(trip.parkingPiastres ?? 0),
        totalKm: trip.totalKmMeters / 1000,
        paidKm: trip.paidKmMeters / 1000,
        notes: trip.notes ?? '',
      };
    }
    const base: FormValues = {
      vehicleId: '',
      driverAppId: '',
      areaId: '',
      startedAt: toDatetimeLocalValue(oneHourAgo),
      endedAt: toDatetimeLocalValue(now),
      grossEgp: 0,
      receivedEgp: undefined,
      tipEgp: 0,
      commissionEgp: 0,
      commissionAuto: true,
      tollEgp: 0,
      parkingEgp: 0,
      totalKm: 0,
      paidKm: 0,
      notes: '',
    };
    if (initialFromOcr) {
      const v = initialFromOcr.values;
      return {
        ...base,
        ...(v.startedAt ? { startedAt: v.startedAt } : {}),
        ...(v.endedAt ? { endedAt: v.endedAt } : {}),
        ...(v.grossEgp != null ? { grossEgp: v.grossEgp } : {}),
        ...(v.receivedEgp != null ? { receivedEgp: v.receivedEgp } : {}),
        ...(v.tipEgp != null ? { tipEgp: v.tipEgp } : {}),
        ...(v.commissionEgp != null ? { commissionEgp: v.commissionEgp } : {}),
        ...(v.commissionAuto != null ? { commissionAuto: v.commissionAuto } : {}),
        ...(v.tollEgp != null ? { tollEgp: v.tollEgp } : {}),
        ...(v.parkingEgp != null ? { parkingEgp: v.parkingEgp } : {}),
        ...(v.totalKm != null ? { totalKm: v.totalKm } : {}),
        ...(v.paidKm != null ? { paidKm: v.paidKm } : {}),
        ...(v.notes ? { notes: v.notes } : {}),
      };
    }
    return base;
  }, [trip, initialFromOcr]);

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

  // Auto-default vehicle/app: pick the first item from each list whenever the
  // currently-selected id is empty. This runs on initial data arrival AND
  // whenever the form resets (e.g. after OCR prefill clears vehicleId).
  useEffect(() => {
    if (!watch('vehicleId') && vehiclesQ.data?.[0]) {
      setValue('vehicleId', vehiclesQ.data[0].id);
    }
    if (!watch('driverAppId') && appsQ.data?.[0]) {
      setValue('driverAppId', appsQ.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiclesQ.data, appsQ.data, initialFromOcr, trip]);

  // Auto-calc commission from gross − received when auto is enabled
  const grossEgp = Number(watch('grossEgp') || 0);
  const receivedEgp = watch('receivedEgp');
  const commissionAuto = watch('commissionAuto');
  useEffect(() => {
    if (!commissionAuto) return;
    if (receivedEgp === undefined || receivedEgp === ('' as unknown as number) || receivedEgp === null) {
      // No received entered → fall back to app's commission% × gross
      const app = appsQ.data?.find((a) => a.id === watch('driverAppId'));
      const pct = app ? Number(app.commissionPct) : 0;
      const auto = Math.max(0, Math.round(grossEgp * (pct / 100) * 100) / 100);
      setValue('commissionEgp', auto);
      return;
    }
    const diff = Math.max(0, grossEgp - Number(receivedEgp));
    setValue('commissionEgp', Math.round(diff * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grossEgp, receivedEgp, commissionAuto, appsQ.data]);

  // Net profit preview (does NOT subtract per-km vehicle cost — kept simple here)
  const totalKm = Number(watch('totalKm') || 0);
  const paidKm = Number(watch('paidKm') || 0);
  const tip = Number(watch('tipEgp') || 0);
  const commission = Number(watch('commissionEgp') || 0);
  const toll = Number(watch('tollEgp') || 0);
  const parking = Number(watch('parkingEgp') || 0);
  const netEgp = grossEgp - commission + tip - toll - parking;
  const emptyKm = Math.max(0, totalKm - paidKm);

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
    const ocrTagged =
      initialFromOcr && initialFromOcr.imageHashes.length > 0
        ? `ocrImageHashes=${initialFromOcr.imageHashes.join(',')}`
        : null;
    const userNotes = v.notes?.trim() || '';
    const mergedNotes = [userNotes, ocrTagged].filter(Boolean).join('\n').slice(0, 500) || null;

    const body: CreateTripInput = {
      vehicleId: v.vehicleId,
      driverAppId: v.driverAppId,
      areaId: v.areaId || undefined,
      startedAt: new Date(v.startedAt).toISOString(),
      endedAt: new Date(v.endedAt).toISOString(),
      grossPiastres: egpToPiastres(Number(v.grossEgp || 0)),
      receivedPiastres:
        v.receivedEgp != null && (v.receivedEgp as unknown as string) !== ''
          ? egpToPiastres(Number(v.receivedEgp))
          : undefined,
      tipPiastres: egpToPiastres(Number(v.tipEgp || 0)),
      commissionPiastres: egpToPiastres(Number(v.commissionEgp || 0)),
      tollPiastres: egpToPiastres(Number(v.tollEgp || 0)),
      parkingPiastres: egpToPiastres(Number(v.parkingEgp || 0)),
      totalKmMeters: Math.round(Number(v.totalKm || 0) * 1000),
      paidKmMeters: Math.round(Number(v.paidKm || 0) * 1000),
      notes: mergedNotes,
    };
    if (initialFromOcr && initialFromOcr.imageHashes.length > 0 && !trip) {
      body.clientMutationId = await deriveClientMutationId(initialFromOcr.imageHashes);
    }
    try {
      if (trip) {
        await updateMut.mutateAsync({ id: trip.id, body });
      } else {
        await createMut.mutateAsync(body);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Trip submit failed', readApiError(err));
    }
  });

  const noVehicles = !vehiclesQ.isLoading && (vehiclesQ.data?.length ?? 0) === 0;
  const noApps = !appsQ.isLoading && (appsQ.data?.length ?? 0) === 0;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {initialFromOcr && initialFromOcr.warnings.length > 0 ? (
        <OcrWarningList warnings={initialFromOcr.warnings} />
      ) : null}
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

      {/* Required */}
      <Section title={t('trips.sections.required')}>
        <Field
          label={t('trips.field.vehicle')}
          htmlFor="vehicleId"
          required
          error={errors.vehicleId ? t('trips.errors.selectVehicle') : null}
        >
          <Select id="vehicleId" {...register('vehicleId')} invalid={!!errors.vehicleId} disabled={noVehicles}>
            <option value="" disabled>—</option>
            {vehiclesQ.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.make, v.model, v.year].filter(Boolean).join(' ') || v.type}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('trips.field.app')}
          htmlFor="driverAppId"
          required
          error={errors.driverAppId ? t('trips.errors.selectApp') : null}
        >
          <Select id="driverAppId" {...register('driverAppId')} invalid={!!errors.driverAppId} disabled={noApps}>
            <option value="" disabled>—</option>
            {appsQ.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.customName ?? a.appSource?.name ?? '—'}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('trips.field.startedAt')}
          htmlFor="startedAt"
          required
          confidence={fieldConfidence(initialFromOcr, 'startedAt')}
        >
          <Input id="startedAt" type="datetime-local" {...register('startedAt')} invalid={!!errors.startedAt} />
        </Field>

        <Field
          label={t('trips.field.endedAt')}
          htmlFor="endedAt"
          required
          confidence={fieldConfidence(initialFromOcr, 'endedAt')}
          error={errors.endedAt?.message === 'end-before-start' ? t('trips.errors.endBeforeStart') : null}
        >
          <Input id="endedAt" type="datetime-local" {...register('endedAt')} invalid={!!errors.endedAt} />
        </Field>
      </Section>

      {/* Money */}
      <Section title={t('trips.sections.money')}>
        <Field
          label={t('trips.field.gross')}
          htmlFor="grossEgp"
          required
          confidence={fieldConfidence(initialFromOcr, 'grossEgp')}
        >
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
        </Field>

        <Field
          label={t('trips.field.received')}
          htmlFor="receivedEgp"
          optional
          hint={t('trips.hint.received')}
          confidence={fieldConfidence(initialFromOcr, 'receivedEgp')}
        >
          <Input
            id="receivedEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            {...register('receivedEgp')}
          />
        </Field>

        <Field
          label={t('trips.field.commission')}
          htmlFor="commissionEgp"
          auto={commissionAuto}
          hint={commissionAuto ? t('trips.hint.commissionAuto') : undefined}
          confidence={fieldConfidence(initialFromOcr, 'commissionEgp')}
          right={
            commissionAuto ? null : (
              <button
                type="button"
                onClick={() => setValue('commissionAuto', true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                <Sparkles className="inline h-3 w-3 align-[-2px]" /> Auto
              </button>
            )
          }
        >
          <Input
            id="commissionEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            readOnly={commissionAuto}
            onFocus={() => commissionAuto && setValue('commissionAuto', false)}
            className={cn(commissionAuto && 'bg-muted/40 text-muted-foreground')}
            {...register('commissionEgp')}
          />
        </Field>

        <Field label={t('trips.field.tip')} htmlFor="tipEgp" optional>
          <Input
            id="tipEgp"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            dir="ltr"
            {...register('tipEgp')}
          />
        </Field>
      </Section>

      {/* Distance */}
      <Section title={t('trips.sections.distance')}>
        <Field
          label={t('trips.field.totalKm')}
          htmlFor="totalKm"
          required
          hint={t('trips.hint.totalKm')}
          confidence={fieldConfidence(initialFromOcr, 'totalKm')}
        >
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
        </Field>

        <Field
          label={t('trips.field.paidKm')}
          htmlFor="paidKm"
          required
          hint={t('trips.hint.paidKm')}
          confidence={fieldConfidence(initialFromOcr, 'paidKm')}
          error={errors.paidKm?.message === 'paid-exceeds-total' ? t('trips.errors.paidExceedsTotal') : null}
        >
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
        </Field>

        <Field label={t('trips.tripEmptyKm')} auto hint={t('trips.hint.emptyKmAuto')}>
          <Input
            type="number"
            value={Number.isFinite(emptyKm) ? emptyKm.toFixed(1) : '0'}
            readOnly
            dir="ltr"
            className="bg-muted/40 text-muted-foreground"
          />
        </Field>
      </Section>

      {/* Extras */}
      <Section title={t('trips.sections.extras')}>
        <Field label={t('trips.field.area')} htmlFor="areaId" optional>
          <Select id="areaId" {...register('areaId')}>
            <option value="">—</option>
            {areasQ.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('trips.field.toll')} htmlFor="tollEgp" optional>
          <Input id="tollEgp" type="number" step="0.01" min={0} dir="ltr" {...register('tollEgp')} />
        </Field>
        <Field label={t('trips.field.parking')} htmlFor="parkingEgp" optional>
          <Input id="parkingEgp" type="number" step="0.01" min={0} dir="ltr" {...register('parkingEgp')} />
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">
            {t('trips.field.notes')} <OptionalBadge t={t} />
          </Label>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </div>
      </Section>

      {/* Net preview + actions */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('trips.net')}
        </p>
        <p
          className={cn(
            'num-tabular mt-1 text-3xl font-bold tracking-tight',
            netEgp >= 0 ? 'text-success' : 'text-destructive',
          )}
        >
          {formatMoney(Math.round(netEgp * 100), locale)}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting || createMut.isPending || updateMut.isPending}>
          {isSubmitting ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  optional,
  auto,
  hint,
  error,
  right,
  confidence,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  auto?: boolean;
  hint?: string | null;
  error?: string | null;
  right?: React.ReactNode;
  confidence?: number | null;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="flex items-center gap-2">
          {label}
          {required ? <RequiredBadge t={t} /> : null}
          {optional ? <OptionalBadge t={t} /> : null}
          {auto ? <AutoBadge t={t} /> : null}
          {confidence != null ? <OcrConfidenceBadge confidence={confidence} /> : null}
        </Label>
        {right}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RequiredBadge({ t }: { t: (k: string) => string }) {
  return (
    <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
      {t('trips.badges.required')}
    </Badge>
  );
}
function OptionalBadge({ t }: { t: (k: string) => string }) {
  return (
    <Badge variant="muted" className="px-1.5 py-0 text-[10px] opacity-70">
      {t('trips.badges.optional')}
    </Badge>
  );
}
function AutoBadge({ t }: { t: (k: string) => string }) {
  return (
    <Badge className="bg-primary/15 text-primary px-1.5 py-0 text-[10px]">
      {t('trips.badges.auto')}
    </Badge>
  );
}
