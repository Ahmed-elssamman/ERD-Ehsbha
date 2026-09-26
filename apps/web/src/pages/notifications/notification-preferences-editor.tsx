import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationPreferencesSchema, type NotificationPreferences } from '@ehsbha/api-contracts';
import { RecordDraftGate } from '@/components/record-drafts/record-draft-gate';
import { RecordDraftNotice } from '@/components/record-drafts/record-draft-notice';
import { RecordDraftError, RecordDraftKind, parseDraftJson } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { useRecordDraftForm } from '@/hooks/use-record-draft-form';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';
import { NotificationPreferencesApi } from './notification-preferences.api';
import { NOTIFICATION_FREQUENCIES, NOTIFICATION_TIME_FIELDS, notificationCommand, notificationCommandSchema, notificationDefaults,
  notificationErrorKey, notificationFieldsSchema, notificationUnconfirmed, validateNotificationDraft, type NotificationFields } from './notifications.control';

interface Props { preferences: NotificationPreferences | null; resumeOnly?: boolean; onClose: () => void }
export function NotificationPreferencesEditor({ preferences, resumeOnly = false, onClose }: Props) {
  return <RecordDraftGate kind={RecordDraftKind.NotificationPreferences} scope="delivery" context={JSON.stringify(preferences)} linkId={null}
    validate={validateNotificationDraft} resumeOnly={resumeOnly} onClose={onClose}>
    {(session) => <PreferencesEditor session={session} onClose={onClose} />}
  </RecordDraftGate>;
}
function PreferencesEditor({ session, onClose }: { session: RecordDraftSession; onClose: () => void }) {
  const context = parseDraftJson(session.initial.context, notificationPreferencesSchema);
  const { t } = useI18n(), qc = useQueryClient();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const form = useForm<NotificationFields>({ defaultValues: session.initial.fields === null ? notificationDefaults(context) : parseDraftJson(session.initial.fields, notificationFieldsSchema) });
  const draft = useRecordDraftForm(session, form, null);
  const mutation = useMutation({ networkMode: 'always', mutationFn: (body: string) => session.submit(body, async (pending) => {
    await NotificationPreferencesApi.update({ ...parseDraftJson(pending.body, notificationCommandSchema), clientMutationId: pending.key });
  }, notificationUnconfirmed), onSuccess: (saved) => { if (saved) finish(); } });
  function finish() { void qc.invalidateQueries({ queryKey: ['notification-preferences'] }); void qc.invalidateQueries({ queryKey: ['record-drafts'] }); onClose(); }
  async function submit() {
    setErrorKey(null);
    const command = notificationCommand(context, form.getValues());
    if (!draft.pending && !command) { setErrorKey('notifications.settings.invalid'); return; }
    session.change(JSON.stringify(form.getValues()), null);
    try { await mutation.mutateAsync(command ? JSON.stringify(command) : session.initial.pending?.body ?? ''); }
    catch (error) { if (error instanceof Error && !(error instanceof RecordDraftError)) setErrorKey(notificationErrorKey(error)); }
  }
  function submitForm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submit(); }
  const locked = draft.locked || mutation.isPending;
  return <Dialog open title={t('notifications.settings.title')} onClose={onClose}>
    <form className="space-y-4" onSubmit={submitForm} noValidate>
      <p className="text-sm text-muted-foreground">{t('notifications.settings.guidance')}</p>
      <fieldset disabled={locked} className="space-y-3">
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" {...form.register('digestEnabled')} />{t('notifications.settings.enabled')}</label>
        <div className="space-y-1"><Label htmlFor="digest-frequency">{t('notifications.settings.frequency')}</Label>
          <select id="digest-frequency" className="min-h-11 w-full rounded-md border bg-background px-3" {...form.register('digestFrequency')}>
            {NOTIFICATION_FREQUENCIES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
          </select></div>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" {...form.register('quietEnabled')} />{t('notifications.settings.quietEnabled')}</label>
        {NOTIFICATION_TIME_FIELDS.map((field) => <div key={field.name} className="space-y-1"><Label htmlFor={field.name}>{t(field.label)}</Label>
          <Input id={field.name} type="time" className="min-h-11" aria-invalid={errorKey === 'notifications.settings.invalid'} aria-describedby="notification-schedule-help" {...form.register(field.name)} /></div>)}
      </fieldset>
      <p id="notification-schedule-help" className="text-sm text-muted-foreground">{t('notifications.settings.timeHelp')}</p>
      {errorKey ? <div role="alert" className="space-y-2 text-sm"><p>{t(errorKey)}</p>
        {errorKey === 'errors.NOTIFICATION_PREFERENCES_CONFLICT' ? <Button type="button" variant="outline" onClick={finish}>{t('notifications.settings.review')}</Button> : null}</div> : null}
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={finish} />
      <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" loading={mutation.isPending}>{t(draft.pending ? 'notifications.settings.retrySaved' : 'common.save')}</Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.close')}</Button></div>
    </form>
  </Dialog>;
}

