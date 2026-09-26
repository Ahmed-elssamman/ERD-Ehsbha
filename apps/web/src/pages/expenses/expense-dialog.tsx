import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resolveLocalDateTime } from '@ehsbha/shared-types';
import { useI18n } from '@/i18n';
import { ExpensesApi, VehiclesApi, type Expense, type CreateExpenseInput } from '@/lib/api/endpoints';
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { RecordDraftError, RecordDraftKind, parseDraftJson, type RecordDraftSummary } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { expenseDraftContextSchema, expenseDraftFieldsSchema, expenseDraftBodySchema, expenseDraftDefaults, validateExpenseDraft } from './expense-draft.control';
import { readApiError } from '@/lib/api/client';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { EXPENSE_CATEGORIES, expenseErrorKey, expenseSaveUnconfirmed, expenseFormSchema, type ExpenseFormInput } from './expenses.control';
import { ExpenseLinkPicker } from './expense-link-picker';

interface Props { expense: Expense | null; onClose: () => void; onSaved: () => void }

export function ExpenseDialog(props: Props) {
  return <RecordDraftGate kind={RecordDraftKind.Expense} scope={props.expense?.id ?? 'new'} context={JSON.stringify(props.expense)}
    linkId={props.expense?.linkedTripId ?? null} validate={validateExpenseDraft} onClose={props.onClose}>
    {(session) => <ExpenseEditor session={session} onClose={props.onClose} onSaved={props.onSaved} />}
  </RecordDraftGate>;
}
function ExpenseEditor({ session, onClose, onSaved }: { session: RecordDraftSession; onClose: () => void; onSaved: () => void }) {
  const expense = parseDraftJson(session.initial.context, expenseDraftContextSchema);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [linkedTripId, setLinkedTripId] = useState(session.initial.linkId);
  const [failure, setFailure] = useState('');
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const form = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema), defaultValues: session.initial.fields !== null ? parseDraftJson(session.initial.fields, expenseDraftFieldsSchema) : expenseDraftDefaults(expense),
  });
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = form;
  const draft = useRecordDraftForm(session, form, linkedTripId);
  const uncertain = draft.pending;
  const mutation = useMutation({ mutationFn: (input: CreateExpenseInput) => session.submit(JSON.stringify(input), async (pending) => {
    const body = parseDraftJson(pending.body, expenseDraftBodySchema);
    if (expense) await ExpensesApi.update(expense.id, { ...body, expectedVersion: expense.version }, pending.key);
    else await ExpensesApi.create({ ...body, clientMutationId: pending.key });
  }, expenseSaveUnconfirmed), onSuccess: (saved) => { if (saved) onSaved(); } });
  const disabled = mutation.isPending || draft.locked;
  const submit = handleSubmit(async (values) => {
    const dateTime = resolveLocalDateTime(values.dateTime, values.dateOccurrence, expense?.dateTime ?? null);
    if (!dateTime) { setError('dateTime', { message: 'time-invalid' }); return; }
    const body: CreateExpenseInput = { category: values.category, amountPiastres: Math.round(Number(values.amountEgp) * 100), dateTime,
      vehicleId: values.vehicleId || null, linkedTripId, isRecurring: values.isRecurring,
      recurrenceRule: expense?.recurrenceRule ?? null, notes: values.notes?.trim() || null };
    session.change(JSON.stringify(form.getValues()), linkedTripId);
    setFailure('');
    try { await mutation.mutateAsync(body); } catch (error) {
      if (!(error instanceof Error) || error instanceof RecordDraftError) return;
      setFailure(expenseErrorKey(error));
      if (readApiError(error).code === 'EXPENSE_VERSION_CONFLICT') void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
  async function close() { if (!mutation.isPending && await session.flush()) onClose(); }
  return <Dialog open onClose={close} title={t(expense ? 'expenses.edit' : 'expenses.add')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" onClick={submit} loading={mutation.isPending}>{t(uncertain ? 'common.retry' : 'common.save')}</Button></>}>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">{t('time.cairo')}</p>
      {failure ? <p role="alert" className="text-sm text-destructive">{t(failure)}</p> : null}
      {uncertain ? <p role="status" className="text-sm">{t('expenses.uncertain')}</p> : null}
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="category">{t('expenses.field.category')}</Label>
            <Select id="category" className="min-h-11" disabled={!!linkedTripId} {...register('category')}>
              {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{t(`expenses.category.${category}`)}</option>)}
            </Select></div>
          <div className="space-y-1.5"><Label htmlFor="amountEgp">{t('expenses.field.amount')}</Label>
            <Input id="amountEgp" className="min-h-11" type="number" inputMode="decimal" step="0.01" min="0.01" max="21474836.47" dir="ltr"
              readOnly={!!linkedTripId} invalid={!!errors.amountEgp} aria-describedby="expense-amount-error" {...register('amountEgp')} />
            {errors.amountEgp ? <p id="expense-amount-error" role="alert" className="text-sm text-destructive">{t('expenses.invalidAmount')}</p> : null}</div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dateTime">{t('expenses.field.dateTime')}</Label>
            <Input id="dateTime" className="min-h-11" type="datetime-local" step="1" invalid={!!errors.dateTime} aria-describedby="expense-time-error" {...register('dateTime')} />
            <LocalTimeChoice value={watch('dateTime')} choice={watch('dateOccurrence')} original={expense?.dateTime ?? null} label={t('expenses.field.dateTime')}
              disabled={disabled} onChange={(choice) => setValue('dateOccurrence', choice, { shouldValidate: true })} />
            {errors.dateTime ? <p id="expense-time-error" role="alert" className="text-sm text-destructive">{t('time.invalid')}</p> : null}</div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="vehicleId">{t('expenses.field.vehicle')}</Label>
            <Select id="vehicleId" className="min-h-11" disabled={!!linkedTripId} {...register('vehicleId')}>
              <option value="">{t('expenses.noVehicle')}</option>
              {expense?.vehicleId && !vehicles.data?.some((vehicle) => vehicle.id === expense.vehicleId)
                ? <option value={expense.vehicleId}>{t('expenses.keepVehicle')}</option> : null}
              {vehicles.data?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {t(`settings.vehicleType.${vehicle.type}`)}</option>)}
            </Select>
            {vehicles.isLoading ? <p role="status" className="text-sm">{t('common.loading')}</p> : null}
            {vehicles.isError ? <div role="alert" className="space-y-2 text-sm"><p>{t('expenses.vehiclesFailed')}</p><Button type="button" variant="outline" onClick={() => void vehicles.refetch()}>{t('common.retry')}</Button></div> : null}
          </div>
        </div>
        <ExpenseLinkPicker category={watch('category')} amountPiastres={Math.round(Number(watch('amountEgp')) * 100)} date={watch('dateTime').slice(0, 10)}
          vehicleId={watch('vehicleId') ?? ''} linkedTripId={linkedTripId} onChange={setLinkedTripId} disabled={disabled} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" {...register('isRecurring')} className="h-5 w-5 accent-primary" />{t('expenses.field.recurring')}</label>
        <p className="text-sm text-muted-foreground">{t('expenses.recurringHint')}</p>
        <div className="space-y-1.5"><Label htmlFor="notes">{t('expenses.field.notes')}</Label><Textarea id="notes" rows={2} maxLength={500} {...register('notes')} /></div>
      </fieldset>
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={onClose} />
    </form>
  </Dialog>;
}

export function ResumeExpenseDraft({ draft, onClose, onSaved }: { draft: RecordDraftSummary; onClose: () => void; onSaved: () => void }) {
  return <RecordDraftGate kind={RecordDraftKind.Expense} resumeOnly scope={draft.scope} context="" linkId={null} validate={validateExpenseDraft} onClose={onClose}>
    {(session) => <ExpenseEditor session={session} onClose={onClose} onSaved={onSaved} />}
  </RecordDraftGate>;
}
