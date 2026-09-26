import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FuelQuantityUnit, fuelQuantityUnit, resolveLocalDateTime } from '@ehsbha/shared-types';
import { FuelApi, type FuelEntry, type Vehicle, type CreateFuelInput } from '@/lib/api/endpoints';
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { RecordDraftError, RecordDraftKind, parseDraftJson, type RecordDraftSummary } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { fuelDraftContextSchema, fuelDraftFieldsSchema, fuelDraftBodySchema, fuelDraftDefaults, validateFuelDraft } from './fuel-draft.control';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { readApiError } from '@/lib/api/client';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { FUEL_COVERAGES, FUEL_KINDS, FUEL_NUMERIC_FIELDS, fuelErrorKey, fuelFormSchema, fuelSaveUnconfirmed, optionalFuelNumber, selectedFuelKind, type FuelFormInput } from './fuel.control';
import { FuelLinkPicker } from './fuel-link-picker';

interface Props { record: FuelEntry | null; vehicle: Vehicle; onClose: () => void; onSaved: () => void }
export function FuelRecordDialog(props: Props) {
  return <RecordDraftGate kind={RecordDraftKind.Fuel} scope={props.record?.id ?? `new:${props.vehicle.id}`} context={JSON.stringify({ record: props.record, vehicle: props.vehicle })}
    linkId={props.record?.linkedExpenseId ?? null} validate={validateFuelDraft} onClose={props.onClose}>
    {(session) => <FuelEditor session={session} onClose={props.onClose} onSaved={props.onSaved} />}
  </RecordDraftGate>;
}
function FuelEditor({ session, onClose, onSaved }: { session: RecordDraftSession; onClose: () => void; onSaved: () => void }) {
  const { record, vehicle } = parseDraftJson(session.initial.context, fuelDraftContextSchema);
  const { t, locale } = useI18n();
  const vehicleName = [vehicle.make, vehicle.model, vehicle.year].filter((value) => value != null).join(' ') || t(`settings.vehicleType.${vehicle.type}`);
  const queryClient = useQueryClient();
  const [linkedExpenseId, setLinkedExpenseId] = useState(session.initial.linkId);
  const [failure, setFailure] = useState('');
  const form = useForm<FuelFormInput>({
    resolver: zodResolver(fuelFormSchema), defaultValues: session.initial.fields !== null ? parseDraftJson(session.initial.fields, fuelDraftFieldsSchema) : fuelDraftDefaults(record, vehicle),
  });
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = form;
  const draft = useRecordDraftForm(session, form, linkedExpenseId);
  const uncertain = draft.pending;
  const values = watch();
  const kind = selectedFuelKind(values.fuelKind);
  const unit = fuelQuantityUnit(kind);
  const liquid = unit === FuelQuantityUnit.Liter;
  const quantity = optionalFuelNumber(values.quantity), price = optionalFuelNumber(values.unitPriceEgp);
  const expectedAmount = quantity !== null && price !== null ? Math.round(quantity * price * 100) : null;
  const total = optionalFuelNumber(values.totalEgp);
  const differs = expectedAmount !== null && total !== null && Number.isFinite(expectedAmount) && expectedAmount !== Math.round(total * 100);
  const mutation = useMutation({ mutationFn: (input: CreateFuelInput) => session.submit(JSON.stringify(input), async (pending) => {
    const body = parseDraftJson(pending.body, fuelDraftBodySchema);
    if (record) await FuelApi.update(record.id, { ...body, expectedVersion: record.version }, pending.key);
    else await FuelApi.create({ ...body, clientMutationId: pending.key }, pending.key);
  }, fuelSaveUnconfirmed), onSuccess: (saved) => { if (saved) onSaved(); } });
  const disabled = mutation.isPending || draft.locked;
  const submit = handleSubmit(async (input) => {
    const dateTime = resolveLocalDateTime(input.dateTime, input.dateOccurrence, record?.dateTime ?? null);
    if (!dateTime) { setError('dateTime', { message: 'time-invalid' }); return; }
    const unitPrice = optionalFuelNumber(input.unitPriceEgp), mileage = optionalFuelNumber(input.odometerKm);
    const body: CreateFuelInput = { vehicleId: vehicle.id, dateTime, fuelKind: selectedFuelKind(input.fuelKind),
      totalPiastres: Math.round(Number(input.totalEgp) * 100), quantity: optionalFuelNumber(input.quantity),
      pricePerUnitPiastres: unitPrice === null ? null : Math.round(unitPrice * 100), odometerMeters: mileage === null ? null : Math.round(mileage * 1000),
      isFullTank: liquid && input.isFullTank, fillCoverage: input.fillCoverage, linkedExpenseId, notes: input.notes.trim() || null };
    session.change(JSON.stringify(form.getValues()), linkedExpenseId);
    setFailure('');
    try { await mutation.mutateAsync(body); } catch (error) {
      if (!(error instanceof Error) || error instanceof RecordDraftError) return;
      setFailure(fuelErrorKey(error));
      if (readApiError(error).code === 'FUEL_VERSION_CONFLICT') void queryClient.invalidateQueries({ queryKey: ['fuel'] });
    }
  });
  async function close() { if (!mutation.isPending && await session.flush()) onClose(); }
  return <Dialog open onClose={close} title={t(record ? 'fuel.edit' : 'fuel.add')}
    footer={<><Button className="min-h-11" variant="ghost" disabled={mutation.isPending} onClick={close}>{t('common.cancel')}</Button>
      <Button className="min-h-11" loading={mutation.isPending} onClick={submit}>{t(uncertain ? 'fuel.retrySave' : 'common.save')}</Button></>}>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="font-medium" data-testid="draft-vehicle">{t('recordDrafts.vehicle')}: {vehicleName}</p>
      <p className="text-sm text-muted-foreground">{t('fuel.entryHint')}</p>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="fuel-dateTime">{t('fuel.field.date')}</Label>
          <Input id="fuel-dateTime" type="datetime-local" dir="ltr" {...register('dateTime')} invalid={!!errors.dateTime} />
          <LocalTimeChoice value={values.dateTime} choice={values.dateOccurrence} original={record?.dateTime ?? null} label={t('fuel.field.date')} disabled={disabled} onChange={(value) => setValue('dateOccurrence', value)} />
          {errors.dateTime ? <p role="alert" className="text-sm text-destructive">{t('fuel.invalidTime')}</p> : null}</div>
        <div className="space-y-1"><Label htmlFor="fuel-kind">{t('fuel.field.kind')}</Label>
          <Select id="fuel-kind" {...register('fuelKind')}><option value="">{t('fuel.kindUnknown')}</option>
            {FUEL_KINDS.map((option) => <option key={option} value={option}>{t(`settings.fuelTypes.${option}`)}</option>)}</Select>
          <p className="text-sm text-muted-foreground">{t(unit ? `fuel.unit.${unit}` : 'fuel.unitUnknown')}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">{FUEL_NUMERIC_FIELDS.map((field) => <div key={field.name} className="space-y-1">
          <Label htmlFor={`fuel-${field.name}`}>{t(field.label)}{field.required ? ' *' : ''}</Label>
          <Input id={`fuel-${field.name}`} type="number" min="0" max={field.maximum} step={field.step} inputMode="decimal" dir="ltr" required={field.required}
            readOnly={field.name === 'totalEgp' && linkedExpenseId !== null} {...register(field.name)} invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `fuel-error-${field.name}` : 'fuel-optional'} />
          {errors[field.name] ? <p id={`fuel-error-${field.name}`} role="alert" className="text-sm text-destructive">{t('fuel.invalidNumber')}</p> : null}
        </div>)}</div>
        <p id="fuel-optional" className="text-xs text-muted-foreground">{t('fuel.optionalHint')}</p>
        {differs ? <p role="status" className="rounded-lg border p-3 text-sm">{t('fuel.amountDifference')} {formatMoney(expectedAmount ?? 0, locale)}</p> : null}
        {liquid ? <label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...register('isFullTank')} />{t('fuel.field.fullTank')}</label> : <p className="text-sm">{t('fuel.nonLiquidHint')}</p>}
        <div className="space-y-1"><Label htmlFor="fuel-coverage">{t('fuel.field.coverage')}</Label>
          <Select id="fuel-coverage" {...register('fillCoverage')}>{FUEL_COVERAGES.map((coverage) => <option key={coverage} value={coverage}>{t(`fuel.coverage.${coverage}`)}</option>)}</Select>
          <p className="text-xs text-muted-foreground">{t('fuel.coverageHint')}</p></div>
        <FuelLinkPicker vehicleId={vehicle.id} amountPiastres={Math.round(Number(values.totalEgp) * 100)} date={values.dateTime.slice(0, 10)} linkedExpenseId={linkedExpenseId} disabled={disabled} onChange={setLinkedExpenseId} />
        <div className="space-y-1"><Label htmlFor="fuel-notes">{t('fuel.field.notes')}</Label><Textarea id="fuel-notes" maxLength={500} {...register('notes')} /></div>
      </fieldset>
      {failure ? <p role="alert" className="text-sm text-destructive">{t(failure)}</p> : null}
      {uncertain ? <p role="status" className="text-sm">{t('fuel.unconfirmed')}</p> : null}
      
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={onClose} />
    </form>
  </Dialog>;
}

export function ResumeFuelDraft({ draft, onClose, onSaved }: { draft: RecordDraftSummary; onClose: () => void; onSaved: () => void }) {
  return <RecordDraftGate kind={RecordDraftKind.Fuel} resumeOnly scope={draft.scope} context="" linkId={null} validate={validateFuelDraft} onClose={onClose}>
    {(session) => <FuelEditor session={session} onClose={onClose} onSaved={onSaved} />}
  </RecordDraftGate>;
}
