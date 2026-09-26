import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkSessionMutation } from '@ehsbha/shared-types';
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { RecordDraftError, RecordDraftKind, parseDraftJson } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { useI18n } from '@/i18n';
import { formatDate, formatDuration } from '@/lib/format';
import { validateWorkSessionDraft, workSessionContextSchema, workSessionFieldsSchema, workSessionDefaults, workSessionCommand,
  workSessionCommandSchema, sendWorkSession, workSessionUnconfirmed, workSessionErrorKey, WORK_SESSION_QUERY_KEYS, WORK_SESSION_DATE_FORMAT,
  type WorkSessionContext, type WorkSessionFields } from './work-sessions.control';

interface Props { context: WorkSessionContext; resumeOnly?: boolean; onClose: () => void }
export function WorkSessionEditor({ context, resumeOnly = false, onClose }: Props) {
  return <RecordDraftGate kind={RecordDraftKind.WorkSession} scope="work-time" context={JSON.stringify(context)} linkId={null}
    validate={validateWorkSessionDraft} resumeOnly={resumeOnly} onClose={onClose}>
    {(session) => <SessionEditor session={session} onClose={onClose} />}
  </RecordDraftGate>;
}
function SessionEditor({ session, onClose }: { session: RecordDraftSession; onClose: () => void }) {
  const context = parseDraftJson(session.initial.context, workSessionContextSchema);
  const { t, locale } = useI18n(), qc = useQueryClient();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const form = useForm<WorkSessionFields>({ defaultValues: session.initial.fields === null ? workSessionDefaults(context) : parseDraftJson(session.initial.fields, workSessionFieldsSchema) });
  const { register, watch, setValue, getValues } = form;
  const draft = useRecordDraftForm(session, form, null);
  const mutation = useMutation({ mutationFn: (body: string) => session.submit(body, async (pending) => {
    await sendWorkSession(parseDraftJson(pending.body, workSessionCommandSchema), pending.key);
  }, workSessionUnconfirmed), onSuccess: (saved) => { if (saved) finish(); } });
  function finish() {
    for (const key of WORK_SESSION_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key] });
    onClose();
  }
  async function submit() {
    setErrorKey(null);
    const command = workSessionCommand(context, getValues());
    if (!draft.pending && !command) { setErrorKey('workSessions.invalidTime'); return; }
    session.change(JSON.stringify(getValues()), null);
    try { await mutation.mutateAsync(command ? JSON.stringify(command) : session.initial.pending?.body ?? ''); }
    catch (error) { if (error instanceof Error && !(error instanceof RecordDraftError)) setErrorKey(workSessionErrorKey(error)); }
  }
  function submitForm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submit(); }
  const action = context.action;
  const statusOnly = action === WorkSessionMutation.Delete || action === WorkSessionMutation.Restore;
  const showEnd = action !== WorkSessionMutation.Start && !statusOnly;
  const locked = draft.locked || mutation.isPending;
  const title = t(`workSessions.action.${action}`);
  const startedAt = watch('startedAt'), endedAt = watch('endedAt');
  const startedOccurrence = watch('startedOccurrence'), endedOccurrence = watch('endedOccurrence');
  const recordedStartedAt = watch('recordedStartedAt'), recordedEndedAt = watch('recordedEndedAt');
  return <Dialog open title={title} onClose={onClose} size="lg">
    <form className="space-y-4" onSubmit={submitForm} noValidate>
      <p className="text-sm text-muted-foreground">{t(statusOnly ? 'workSessions.statusConfirmation' : 'workSessions.timeGuidance')}</p>
      {context.record?.driverAppId ? <p className="text-sm">{t('workSessions.platformSession')}</p> : null}
      {statusOnly && context.record ? <div className="space-y-2 rounded-lg border p-3 text-sm">
        <p>{t('workSessions.startedAt')}: {formatDate(context.record.startedAt, locale, WORK_SESSION_DATE_FORMAT)}</p>
        <p>{context.record.endedAt ? `${t('workSessions.endedAt')}: ${formatDate(context.record.endedAt, locale, WORK_SESSION_DATE_FORMAT)}` : t('workSessions.open')}</p>
        <p>{formatDuration(context.record.activeMinutes, locale)} · {t('expenses.history.version', { version: context.record.version })}</p>
      </div> : null}
      {!statusOnly ? <fieldset disabled={locked} className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('time.cairo')}</p>
        <div className="space-y-2"><Label htmlFor="work-start">{t('workSessions.startedAt')}</Label>
          <Input id="work-start" type="datetime-local" step="1" aria-invalid={errorKey === 'workSessions.invalidTime'} aria-describedby={errorKey ? 'work-time-error' : ''} readOnly={action === WorkSessionMutation.End} {...register('startedAt')} />
          {action !== WorkSessionMutation.End ? <LocalTimeChoice value={startedAt} choice={startedOccurrence} original={recordedStartedAt}
            label={t('workSessions.startedAt')} onChange={(value) => setValue('startedOccurrence', value)} /> : null}</div>
        {showEnd ? <div className="space-y-2"><Label htmlFor="work-end">{t('workSessions.endedAt')}</Label>
          <Input id="work-end" type="datetime-local" step="1" aria-invalid={errorKey === 'workSessions.invalidTime'} aria-describedby={errorKey ? 'work-time-error' : ''} {...register('endedAt')} />
          <LocalTimeChoice value={endedAt} choice={endedOccurrence} original={recordedEndedAt}
            label={t('workSessions.endedAt')} onChange={(value) => setValue('endedOccurrence', value)} /></div> : null}
      </fieldset> : null}
      {errorKey ? <div id="work-time-error" role="alert" className="space-y-2 text-sm text-destructive"><p>{t(errorKey)}</p>
        <Button type="button" variant="outline" onClick={finish}>{t('workSessions.reviewCurrent')}</Button></div> : null}
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={finish} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" variant={action === WorkSessionMutation.Delete ? 'destructive' : 'default'} loading={mutation.isPending}>{draft.pending ? t('workSessions.retrySaved') : title}</Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.close')}</Button>
      </div>
    </form>
  </Dialog>;
}
