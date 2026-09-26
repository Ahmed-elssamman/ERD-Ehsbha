import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resolveLocalDateTime } from '@ehsbha/shared-types';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { MaintenanceApi, type MaintenanceRecord, type Vehicle, type CreateMaintenanceInput } from '@/lib/api/endpoints';
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { RecordDraftError, RecordDraftKind, parseDraftJson, type RecordDraftSummary } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { maintenanceDraftContextSchema, maintenanceDraftFieldsSchema, maintenanceDraftBodySchema, maintenanceDraftDefaults, validateMaintenanceDraft } from './maintenance-draft.control';
import { readApiError } from '@/lib/api/client';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { maintenanceErrorKey, maintenanceSaveUnconfirmed, maintenanceFormSchema, type MaintenanceFormInput } from './maintenance.control';
import { MaintenanceLinkPicker } from './maintenance-link-picker';

interface Props { record: MaintenanceRecord | null; vehicle: Vehicle; onClose: () => void; onSaved: () => void }
export function MaintenanceRecordDialog(props: Props) {
  return <RecordDraftGate kind={RecordDraftKind.Maintenance} scope={props.record?.id ?? `new:${props.vehicle.id}`} context={JSON.stringify({ record: props.record, vehicle: props.vehicle })}
    linkId={props.record?.linkedExpenseId ?? null} validate={validateMaintenanceDraft} onClose={props.onClose}>
    {(session) => <MaintenanceEditor session={session} onClose={props.onClose} onSaved={props.onSaved} />}
  </RecordDraftGate>;
}
function MaintenanceEditor({ session, onClose, onSaved }: { session: RecordDraftSession; onClose: () => void; onSaved: () => void }) {
  const { record, vehicle } = parseDraftJson(session.initial.context, maintenanceDraftContextSchema);
  const { t } = useI18n();
  const vehicleName = [vehicle.make, vehicle.model, vehicle.year].filter((value) => value != null).join(' ') || t(`settings.vehicleType.${vehicle.type}`);
  const itemLabel = useMaintenanceItemLabel();
  const queryClient = useQueryClient();
  const [linkedExpenseId, setLinkedExpenseId] = useState(session.initial.linkId);
  const [failure, setFailure] = useState('');
  const itemsQuery = useQuery({ queryKey: ['maintenance', 'items'], queryFn: MaintenanceApi.items });
  const items = (itemsQuery.data ?? []).filter((item) => vehicle.type === 'CAR' ? item.appliesToCar : item.appliesToBike)
    .map((item) => ({ ...item, label: itemLabel(item) })).sort((a, b) => a.label.localeCompare(b.label));
  const form = useForm<MaintenanceFormInput>({
    resolver: zodResolver(maintenanceFormSchema), defaultValues: session.initial.fields !== null ? parseDraftJson(session.initial.fields, maintenanceDraftFieldsSchema) : maintenanceDraftDefaults(record, vehicle),
  });
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = form;
  const draft = useRecordDraftForm(session, form, linkedExpenseId);
  const uncertain = draft.pending;
  const mutation = useMutation({ mutationFn: (input: CreateMaintenanceInput) => session.submit(JSON.stringify(input), async (pending) => {
    const body = parseDraftJson(pending.body, maintenanceDraftBodySchema);
    if (record) await MaintenanceApi.updateRecord(vehicle.id, record.id, { ...body, expectedVersion: record.version }, pending.key);
    else await MaintenanceApi.addRecord(vehicle.id, { ...body, clientMutationId: pending.key }, pending.key);
  }, maintenanceSaveUnconfirmed), onSuccess: (saved) => { if (saved) onSaved(); } });
  const disabled = mutation.isPending || draft.locked;
  const submit = handleSubmit(async (values) => {
    const performedAt = resolveLocalDateTime(values.performedAt, values.dateOccurrence, record?.performedAt ?? null);
    if (!performedAt) { setError('performedAt', { message: 'time-invalid' }); return; }
    const body: CreateMaintenanceInput = { maintenanceItemId: values.maintenanceItemId, performedAt,
      odometerMeters: Math.round(Number(values.odometerKm) * 1000), costPiastres: Math.round(Number(values.costEgp) * 100), linkedExpenseId, notes: values.notes.trim() || null };
    session.change(JSON.stringify(form.getValues()), linkedExpenseId);
    setFailure('');
    try { await mutation.mutateAsync(body); } catch (error) {
      if (!(error instanceof Error) || error instanceof RecordDraftError) return;
      setFailure(maintenanceErrorKey(error));
      if (readApiError(error).code === 'MAINTENANCE_VERSION_CONFLICT') void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    }
  });
  async function close() { if (!mutation.isPending && await session.flush()) onClose(); }
  return <Dialog open onClose={close} title={t(record ? 'maintenance.edit' : 'maintenance.addRecord')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" onClick={submit} loading={mutation.isPending}>{t(uncertain ? 'common.retry' : 'common.save')}</Button></>}>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="font-medium" data-testid="draft-vehicle">{t('recordDrafts.vehicle')}: {vehicleName}</p>
      <p className="text-sm text-muted-foreground">{t('maintenance.paymentBasis')}</p>
      {failure ? <p role="alert" className="text-sm text-destructive">{t(failure)}</p> : null}
      {uncertain ? <p role="status">{t('maintenance.uncertain')}</p> : null}
      <fieldset disabled={disabled} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="maintenanceItemId">{t('maintenance.field.item')}</Label>
          <Select id="maintenanceItemId" className="min-h-11" invalid={!!errors.maintenanceItemId} aria-describedby="maintenance-item-error" {...register('maintenanceItemId')}>
            <option value="">{t('maintenance.chooseItem')}</option>
            {record && !items.some((item) => item.id === record.maintenanceItemId) ? <option value={record.maintenanceItemId}>{record.maintenanceItem ? itemLabel(record.maintenanceItem) : t('maintenance.keepItem')}</option> : null}
            {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          {errors.maintenanceItemId ? <p id="maintenance-item-error" role="alert">{t('maintenance.chooseItem')}</p> : null}
          {itemsQuery.isLoading ? <p role="status">{t('common.loading')}</p> : null}
          {itemsQuery.isError ? <div role="alert"><p>{t('maintenance.itemsFailed')}</p><Button type="button" variant="outline" onClick={() => void itemsQuery.refetch()}>{t('common.retry')}</Button></div> : null}
        </div>
        <div className="space-y-1.5"><Label htmlFor="performedAt">{t('maintenance.field.performedAt')}</Label>
          <Input id="performedAt" className="min-h-11" type="datetime-local" step="1" invalid={!!errors.performedAt} aria-describedby="maintenance-time-error" {...register('performedAt')} />
          <LocalTimeChoice value={watch('performedAt')} choice={watch('dateOccurrence')} original={record?.performedAt ?? null} label={t('maintenance.field.performedAt')}
            disabled={disabled} onChange={(choice) => setValue('dateOccurrence', choice, { shouldValidate: true })} />
          {errors.performedAt ? <p id="maintenance-time-error" role="alert">{t('time.invalid')}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="odometerKm">{t('maintenance.field.odometer')}</Label>
            <Input id="odometerKm" className="min-h-11" type="number" inputMode="decimal" min="0" step="0.001" dir="ltr" invalid={!!errors.odometerKm} aria-describedby="maintenance-odometer-error" {...register('odometerKm')} />
            {errors.odometerKm ? <p id="maintenance-odometer-error" role="alert">{t('maintenance.invalidOdometer')}</p> : null}</div>
          <div className="space-y-1.5"><Label htmlFor="costEgp">{t('maintenance.field.cost')}</Label>
            <Input id="costEgp" className="min-h-11" type="number" inputMode="decimal" min="0" step="0.01" max="21474836.47" dir="ltr" readOnly={!!linkedExpenseId} invalid={!!errors.costEgp} aria-describedby="maintenance-cost-error" {...register('costEgp')} />
            {errors.costEgp ? <p id="maintenance-cost-error" role="alert">{t('maintenance.invalidCost')}</p> : null}</div>
        </div>
        <MaintenanceLinkPicker vehicleId={vehicle.id} amountPiastres={Math.round(Number(watch('costEgp')) * 100)} date={watch('performedAt').slice(0, 10)} linkedExpenseId={linkedExpenseId} disabled={disabled} onChange={setLinkedExpenseId} />
        <div className="space-y-1.5"><Label htmlFor="maintenance-notes">{t('maintenance.field.notes')}</Label><Textarea id="maintenance-notes" rows={2} maxLength={500} {...register('notes')} /></div>
      </fieldset>
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={onClose} />
    </form>
  </Dialog>;
}

export function ResumeMaintenanceDraft({ draft, onClose, onSaved }: { draft: RecordDraftSummary; onClose: () => void; onSaved: () => void }) {
  return <RecordDraftGate kind={RecordDraftKind.Maintenance} resumeOnly scope={draft.scope} context="" linkId={null} validate={validateMaintenanceDraft} onClose={onClose}>
    {(session) => <MaintenanceEditor session={session} onClose={onClose} onSaved={onSaved} />}
  </RecordDraftGate>;
}
