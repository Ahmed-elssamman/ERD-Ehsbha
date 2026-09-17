import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TripIncomeMode, resolveTripFinancials, resolveLocalDateTime, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { tripFormSchema, TRIP_INCOME_OPTIONS, type TripFormInput } from './trip-form.control';
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
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { RecordDraftKind, RecordDraftError, parseDraftJson } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { tripDraftContextSchema, tripDraftFieldsSchema, tripDraftBodySchema, tripDraftDefaults, validateTripDraft, tripSaveUnconfirmed, tripErrorKey, TRIP_QUERY_KEYS } from './trip-draft.control';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

const egpToPiastres = (egp: number) => Math.round(egp * 100);
interface Props { trip?: TripItem | null; scope?: string; resumeOnly?: boolean; onDone: (id: string) => void; onClose: () => void }

export function TripForm({ trip = null, scope, resumeOnly = false, onDone, onClose }: Props) {
  return <RecordDraftGate inline kind={RecordDraftKind.Trip} scope={scope ?? trip?.id ?? 'new'} context={JSON.stringify({ trip })}
    linkId={null} resumeOnly={resumeOnly} validate={validateTripDraft} onClose={onClose}>
    {(session) => <TripEditor session={session} onDone={onDone} onClose={onClose} />}
  </RecordDraftGate>;
}
function TripEditor({ session, onDone, onClose }: { session: RecordDraftSession; onDone: (id: string) => void; onClose: () => void }) {
  const { trip } = parseDraftJson(session.initial.context, tripDraftContextSchema);
  const receiptId = useRef<string | null>(null);
  const hasUserInput = useRef(session.initial.fields !== null);
  const shouldPersist = useCallback(() => hasUserInput.current, []);
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const appsQ = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: AreasApi.list });

  const form = useForm<TripFormInput>({
    resolver: zodResolver(tripFormSchema, {}, { raw: true }), mode: 'onBlur',
    defaultValues: session.initial.fields !== null ? parseDraftJson(session.initial.fields, tripDraftFieldsSchema) : tripDraftDefaults(trip),
  });
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = form;
  const draft = useRecordDraftForm(session, form, null, shouldPersist);
  useEffect(() => {
    if (draft.locked || session.initial.fields !== null) return;
    if (!form.getValues('vehicleId') && vehiclesQ.data?.[0]) setValue('vehicleId', vehiclesQ.data[0].id);
    if (!form.getValues('driverAppId') && appsQ.data?.[0]) setValue('driverAppId', appsQ.data[0].id);
  }, [vehiclesQ.data, appsQ.data, draft.locked, session, form, setValue]);

  // Auto-calc commission from gross − received when auto is enabled
  const incomeMode = watch('incomeMode');
  const grossEgp = Number(watch('grossEgp') || 0);
  const receivedEgp = watch('receivedEgp');
  const commissionAuto = watch('commissionAuto');
  useEffect(() => {
    if (draft.locked || !commissionAuto || incomeMode === TripIncomeMode.TakeHome) return;
    if (receivedEgp === '' || !String(watch('grossEgp')).trim()) {
      setValue('commissionEgp', '');
      return;
    }
    const diff = Math.max(0, grossEgp - Number(receivedEgp));
    setValue('commissionEgp', Math.round(diff * 100) / 100);

  }, [grossEgp, receivedEgp, commissionAuto, incomeMode, setValue, watch, draft.locked]);

  // Net profit preview (does NOT subtract per-km vehicle cost — kept simple here)
  const totalKm = Number(watch('totalKm') || 0);
  const paidKm = Number(watch('paidKm') || 0);
  const tip = Number(watch('tipEgp') || 0);
  const toll = Number(watch('tollEgp') || 0);
  const parking = Number(watch('parkingEgp') || 0);
  const previewMoney = (value: string | number): number | null => String(value).trim() === '' ? null : Math.round(Number(value) * 100);
  const financialPreview = resolveTripFinancials({
    grossPiastres: incomeMode === TripIncomeMode.TakeHome ? null : previewMoney(watch('grossEgp')),
    commissionPiastres: incomeMode === TripIncomeMode.TakeHome ? null : previewMoney(watch('commissionEgp')),
    receivedPiastres: incomeMode === TripIncomeMode.TakeHome ? null : previewMoney(watch('receivedEgp')),
    earningsPiastres: incomeMode === TripIncomeMode.TakeHome ? previewMoney(watch('earningsEgp')) : null,
    tipPiastres: egpToPiastres(tip),
  });
  const netEgp = financialPreview === null ? null : financialPreview.earningsPiastres / 100 - toll - parking;
  const emptyKm = Math.max(0, totalKm - paidKm);

  const mutation = useMutation({
    mutationFn: (input: CreateTripInput) => session.submit(JSON.stringify(input), async (pending) => {
      const body = parseDraftJson(pending.body, tripDraftBodySchema);
      const saved = trip ? await TripsApi.update(trip.id, { ...body, expectedVersion: trip.version }, pending.key)
        : await TripsApi.create({ ...body, clientMutationId: pending.key });
      receiptId.current = saved.id;
    }, tripSaveUnconfirmed),
    onSuccess: (saved) => {
      if (!saved || !receiptId.current) return;
      for (const key of TRIP_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key] });
      onDone(receiptId.current);
    },
  });
  const disabled = mutation.isPending || draft.locked;

  const submit = handleSubmit(async (values) => {
    const v = tripFormSchema.parse(values);
    setSubmitError(null);
    const startedAt = resolveLocalDateTime(v.startedAt, v.startedOccurrence, v.recordedStartedAt);
    const endedAt = resolveLocalDateTime(v.endedAt, v.endedOccurrence, v.recordedEndedAt);
    if (!startedAt || !endedAt) { setSubmitError(t('time.invalid')); return; }
    const takeHome = v.incomeMode === TripIncomeMode.TakeHome;
    const body: CreateTripInput = {
      vehicleId: v.vehicleId,
      driverAppId: v.driverAppId,
      areaId: v.areaId || null,
      startedAt, endedAt,
      grossPiastres: takeHome || v.grossEgp === null ? null : egpToPiastres(v.grossEgp),
      earningsPiastres: takeHome && v.earningsEgp !== null ? egpToPiastres(v.earningsEgp) : null,
      receivedPiastres: takeHome || v.receivedEgp === null ? null : egpToPiastres(v.receivedEgp),
      tipPiastres: egpToPiastres(Number(v.tipEgp || 0)),
      commissionPiastres: takeHome || v.commissionEgp === null ? null : egpToPiastres(v.commissionEgp),
      tollPiastres: egpToPiastres(Number(v.tollEgp || 0)),
      parkingPiastres: egpToPiastres(Number(v.parkingEgp || 0)),
      totalKmMeters: Math.round(Number(v.totalKm || 0) * 1000),
      paidKmMeters: Math.round(Number(v.paidKm || 0) * 1000),
      notes: v.notes?.trim() || null,
    };
    session.change(JSON.stringify(form.getValues()), null);
    const validatedBody = tripDraftBodySchema.safeParse(body);
    if (!validatedBody.success) { setSubmitError(t('trips.invalidValues')); return; }
    try { await mutation.mutateAsync(validatedBody.data); }
    catch (error) {
      if (!(error instanceof Error) || error instanceof RecordDraftError) return;
      setSubmitError(t(tripErrorKey(error)));
      if (readApiError(error).code === 'TRIP_VERSION_CONFLICT') void qc.invalidateQueries({ queryKey: ['trip', trip?.id] });
    }
  });

  const noVehicles = vehiclesQ.isSuccess && (vehiclesQ.data?.length ?? 0) === 0;
  let endTimeError: string | null = null;
  if (errors.endedAt) {
    let key = 'time.invalid';
    if (errors.endedAt.message === 'end-before-start') key = 'trips.errors.endBeforeStart';
    if (errors.endedAt.message === 'interval-too-long') key = 'time.intervalTooLong';
    endTimeError = t(key);
  }
  const noApps = appsQ.isSuccess && (appsQ.data?.length ?? 0) === 0;

  function retryLookups() { void vehiclesQ.refetch(); void appsQ.refetch(); void areasQ.refetch(); }
  const lookupFailed = vehiclesQ.isError || appsQ.isError || areasQ.isError;
  return (
    <form onSubmit={submit} onChangeCapture={() => { hasUserInput.current = true; }} className="space-y-6" noValidate>
      {lookupFailed ? <div role="alert" className="space-y-2 text-sm"><p>{t('trips.lookupsFailed')}</p><Button type="button" variant="outline" onClick={retryLookups}>{t('common.retry')}</Button></div> : null}
      <fieldset disabled={disabled} className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('time.cairo')}</p>
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
          error={errors.startedAt ? t('time.invalid') : null}
          required
        >
          <Input id="startedAt" type="datetime-local" step="1" {...register('startedAt')} invalid={!!errors.startedAt} />
          <LocalTimeChoice value={watch('startedAt')} choice={watch('startedOccurrence') ?? LocalTimeOccurrence.Unspecified}
            original={trip?.startedAt ?? null} label={t('trips.field.startedAt')} onChange={(choice) => setValue('startedOccurrence', choice, { shouldValidate: true })} />
        </Field>

        <Field
          label={t('trips.field.endedAt')}
          htmlFor="endedAt"
          required
          error={endTimeError}
        >
          <Input id="endedAt" type="datetime-local" step="1" {...register('endedAt')} invalid={!!errors.endedAt} />
          <LocalTimeChoice value={watch('endedAt')} choice={watch('endedOccurrence') ?? LocalTimeOccurrence.Unspecified}
            original={trip?.endedAt ?? null} label={t('trips.field.endedAt')} onChange={(choice) => setValue('endedOccurrence', choice, { shouldValidate: true })} />
        </Field>
      </Section>

      {/* Money */}
      <Section title={t('trips.sections.money')}>
        <Field label={t('trips.finance.mode')} htmlFor="incomeMode">
          <Select id="incomeMode" {...register('incomeMode')}>
            {TRIP_INCOME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
          </Select>
        </Field>
        {incomeMode === TripIncomeMode.TakeHome ? <>
          <Field label={t('trips.finance.earnings')} htmlFor="earningsEgp" required hint={t('trips.finance.takeHomeHint')}
            error={errors.earningsEgp ? t('trips.finance.invalid') : null}>
            <Input id="earningsEgp" type="number" inputMode="decimal" step="0.01" min={0} dir="ltr" {...register('earningsEgp')} invalid={!!errors.earningsEgp} />
          </Field>
        </> : <>

        <Field
          label={t('trips.field.gross')}
          htmlFor="grossEgp"
          error={errors.grossEgp ? t('trips.finance.invalid') : null}
          required
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
          error={errors.receivedEgp?.message === 'received-exceeds-gross' ? t('trips.errors.receivedExceedsGross') : null}
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
          right={
            commissionAuto ? null : (
              <button
                type="button"
                onClick={() => setValue('commissionAuto', true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                <Sparkles className="inline h-3 w-3 align-[-2px]" /> {t('trips.finance.calculate')}
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

        </>}
        <Field label={t(incomeMode === TripIncomeMode.TakeHome ? 'trips.finance.includedTip' : 'trips.field.tip')} htmlFor="tipEgp" optional>
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
          <Textarea id="notes" rows={2} maxLength={500} {...register('notes')} />
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
            (netEgp ?? 0) >= 0 ? 'text-success' : 'text-destructive',
          )}
        >
          {formatMoney(netEgp === null ? null : Math.round(netEgp * 100), locale)}
        </p>
      </div>

      </fieldset>
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={onClose} />
      {submitError ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" loading={isSubmitting || mutation.isPending}>
          {t(draft.pending ? 'trips.retrySave' : 'common.save')}
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
