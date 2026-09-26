import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportPreferencesSchema, type ReportPreferences } from '@ehsbha/api-contracts';
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
import { ReportsApi } from './reports.api';
import { reportErrorKey, reportUnconfirmed } from './report-draft.control';
import { REPORT_TIME_FIELDS, reportPreferenceCommand, reportPreferenceCommandSchema, reportPreferenceDefaults,
  reportPreferenceFormSchema, validateReportPreferenceDraft, type ReportPreferenceForm } from './report-preferences.control';

interface Props { preferences: ReportPreferences | null; resumeOnly?: boolean; onClose: () => void }
export function ReportPreferencesEditor({ preferences, resumeOnly = false, onClose }: Props) {
  return <RecordDraftGate kind={RecordDraftKind.ReportPreferences} scope="delivery" context={JSON.stringify(preferences)} linkId={null}
    validate={validateReportPreferenceDraft} resumeOnly={resumeOnly} onClose={onClose}>
    {(session) => <PreferencesEditor session={session} onClose={onClose} />}
  </RecordDraftGate>;
}
function PreferencesEditor({ session, onClose }: { session: RecordDraftSession; onClose: () => void }) {
  const context = parseDraftJson(session.initial.context, reportPreferencesSchema);
  const { t } = useI18n(), qc = useQueryClient();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const form = useForm<ReportPreferenceForm>({ defaultValues: session.initial.fields === null ? reportPreferenceDefaults(context) : parseDraftJson(session.initial.fields, reportPreferenceFormSchema) });
  const draft = useRecordDraftForm(session, form, null);
  const mutation = useMutation({ networkMode: 'always', mutationFn: (body: string) => session.submit(body, async (pending) => {
    await ReportsApi.updatePreferences({ ...parseDraftJson(pending.body, reportPreferenceCommandSchema), clientMutationId: pending.key });
  }, reportUnconfirmed), onSuccess: (saved) => { if (saved) finish(); } });
  function finish() { void qc.invalidateQueries({ queryKey: ['report-preferences'] }); void qc.invalidateQueries({ queryKey: ['record-drafts'] }); onClose(); }
  async function submit() {
    setErrorKey(null);
    const command = reportPreferenceCommand(context, form.getValues());
    if (!draft.pending && !command) { setErrorKey('reports.settings.invalid'); return; }
    session.change(JSON.stringify(form.getValues()), null);
    try { await mutation.mutateAsync(command ? JSON.stringify(command) : session.initial.pending?.body ?? ''); }
    catch (error) { if (error instanceof Error && !(error instanceof RecordDraftError)) setErrorKey(reportErrorKey(error)); }
  }
  function submitForm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submit(); }
  const locked = draft.locked || mutation.isPending;
  return <Dialog open title={t('reports.settings.title')} onClose={onClose}>
    <form className="space-y-4" onSubmit={submitForm} noValidate>
      <p className="text-sm text-muted-foreground">{t('reports.settings.guidance')}</p>
      <fieldset disabled={locked} className="space-y-3">
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" {...form.register('weeklyEnabled')} />{t('reports.settings.weekly')}</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" {...form.register('monthlyEnabled')} />{t('reports.settings.monthly')}</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" {...form.register('quietEnabled')} />{t('reports.settings.quietEnabled')}</label>
        {REPORT_TIME_FIELDS.map((field) => <div key={field.name} className="space-y-1"><Label htmlFor={field.name}>{t(field.label)}</Label>
          <Input id={field.name} type="time" className="min-h-11" aria-invalid={errorKey === 'reports.settings.invalid'} aria-describedby="report-schedule-help" {...form.register(field.name)} /></div>)}
      </fieldset>
      <p id="report-schedule-help" className="text-sm text-muted-foreground">{t('reports.settings.timeHelp')}</p>
      {errorKey ? <div role="alert" className="space-y-2 text-sm"><p>{t(errorKey)}</p>
        {errorKey === 'errors.REPORT_PREFERENCES_CONFLICT' ? <Button type="button" variant="outline" onClick={finish}>{t('reports.settings.review')}</Button> : null}</div> : null}
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={finish} />
      <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" loading={mutation.isPending}>{t(draft.pending ? 'reports.settings.retrySaved' : 'common.save')}</Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.close')}</Button></div>
    </form>
  </Dialog>;
}

