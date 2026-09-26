import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ReportMutation } from '@ehsbha/shared-types';
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
import { REPORT_PERIOD_OPTIONS, reportDraftCommandSchema, reportDraftContextSchema, reportFieldsSchema, reportErrorKey, reportUnconfirmed, validateReportDraft, type ReportFields, type ReportDraftContext } from './report-draft.control';

interface Props { context: ReportDraftContext | null; scope: string; resumeOnly?: boolean; onClose: () => void }
export function ReportEditor({ context, scope, resumeOnly = false, onClose }: Props) {
  return <RecordDraftGate kind={RecordDraftKind.Report} scope={scope} context={JSON.stringify(context)} linkId={null} validate={validateReportDraft} resumeOnly={resumeOnly} onClose={onClose}>
    {(session) => <Editor session={session} onClose={onClose} />}
  </RecordDraftGate>;
}
function Editor({ session, onClose }: { session: RecordDraftSession; onClose: () => void }) {
  const context = parseDraftJson(session.initial.context, reportDraftContextSchema);
  const { t } = useI18n(), qc = useQueryClient(), navigate = useNavigate();
  const savedPath = useRef<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const form = useForm<ReportFields>({ defaultValues: session.initial.fields === null ? { period: context.period, date: context.date } : parseDraftJson(session.initial.fields, reportFieldsSchema) });
  const draft = useRecordDraftForm(session, form, null);
  const mutation = useMutation({ networkMode: 'always', mutationFn: (body: string) => session.submit(body, async (pending) => {
    const command = parseDraftJson(pending.body, reportDraftCommandSchema);
    const result = command.action === ReportMutation.Create ? await ReportsApi.create({ period: command.period, date: command.date, clientMutationId: pending.key })
      : await ReportsApi.revise(command.id ?? '', { expectedVersion: command.version, clientMutationId: pending.key });
    savedPath.current = `/reports/${result.id}/revisions/${result.version}`;
  }, reportUnconfirmed), onSuccess: (saved) => { if (saved) { finish(); if (savedPath.current) navigate(savedPath.current); } } });
  function finish() { void qc.invalidateQueries({ queryKey: ['reports'] }); void qc.invalidateQueries({ queryKey: ['record-drafts'] }); onClose(); }
  async function submit() {
    setErrorKey(null);
    const command = reportDraftCommandSchema.safeParse(context.action === ReportMutation.Create ? { ...context, ...form.getValues() } : context);
    if (!draft.pending && !command.success) { setErrorKey('reports.invalid'); return; }
    session.change(JSON.stringify(form.getValues()), null);
    try { await mutation.mutateAsync(command.success ? JSON.stringify(command.data) : session.initial.pending?.body ?? ''); }
    catch (error) { if (error instanceof Error && !(error instanceof RecordDraftError)) setErrorKey(reportErrorKey(error)); }
  }
  function submitForm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void submit(); }
  const revising = context.action === ReportMutation.Revise, locked = draft.locked || mutation.isPending;
  const conflict = errorKey === 'errors.REPORT_VERSION_CONFLICT';
  return <Dialog open title={t(revising ? 'reports.revise' : 'reports.create')} onClose={onClose}>
    <form onSubmit={submitForm} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">{t(revising ? 'reports.reviseHelp' : 'reports.createHelp')}</p>
      <fieldset disabled={locked || revising} className="space-y-3">
        <div className="space-y-1"><Label htmlFor="report-period">{t('reports.period')}</Label><select id="report-period" className="min-h-11 w-full rounded-md border bg-background px-3" {...form.register('period')}>
          {REPORT_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
        </select></div>
        <div className="space-y-1"><Label htmlFor="report-date">{t('reports.date')}</Label><Input id="report-date" type="date" className="min-h-11" {...form.register('date')} /></div>
      </fieldset>
      {errorKey ? <div role="alert" className="space-y-2"><p>{t(errorKey)}</p>{conflict ? <Button type="button" variant="outline" onClick={finish}>{t('reports.reviewCurrent')}</Button> : null}</div> : null}
      <RecordDraftNotice session={session} busy={mutation.isPending} onDiscard={finish} />
      <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" loading={mutation.isPending}>{t(draft.pending ? 'reports.retrySaved' : revising ? 'reports.revise' : 'reports.create')}</Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.close')}</Button></div>
    </form>
  </Dialog>;
}
