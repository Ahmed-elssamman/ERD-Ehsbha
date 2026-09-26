import { describe, expect, it } from 'vitest';
import { ReportMutation, ReportPeriod } from '@ehsbha/shared-types';
import { RecordDraftKind, RecordDraftStatus, RecordDraftError } from '@/lib/record-drafts/record-draft.model';
import { ChecklistAnswer, freshWellness, ReminderKind } from '@/lib/wellness/wellness.control';
import { reportDraftCommandSchema, newReportContext, validateReportDraft } from './report-draft.control';
import { reportPreferenceCommand } from './report-preferences.control';
import { reportWellnessRows } from './reports.control';

describe('report draft and local wellness boundaries', () => {
  it('defaults to the completed Cairo week independently of the device timezone', () => {
    expect(newReportContext(new Date('2026-09-06T21:00:00Z'))).toMatchObject({ period: ReportPeriod.Weekly, date: '2026-08-31', action: ReportMutation.Create });
    expect(reportDraftCommandSchema.safeParse({ ...newReportContext(), date: '2026-02-30' }).success).toBe(false);
  });
  it('rejects a persisted revision request for a different record or period', () => {
    const context = { action: ReportMutation.Revise, id: 'report-a', version: 2, period: ReportPeriod.Weekly, date: '2026-08-31' };
    const draft = { schemaVersion: 1 as const, generation: crypto.randomUUID(), accountId: 'owner', kind: RecordDraftKind.Report, scope: 'revise:report-a', revision: 1,
      status: RecordDraftStatus.Pending, context: JSON.stringify(context), fields: null, linkId: null, updatedAt: Date.now(), pending: { key: crypto.randomUUID(), body: JSON.stringify(context), startedAt: Date.now() } };
    expect(() => validateReportDraft(draft)).not.toThrow();
    for (const changed of [{ id: 'report-b' }, { version: 3 }, { date: '2026-08-24' }, { period: ReportPeriod.Monthly }]) {
      expect(() => validateReportDraft({ ...draft, pending: { ...draft.pending, body: JSON.stringify({ ...context, ...changed }) } })).toThrow(RecordDraftError);
    }
  });
  it('checks report delivery times before persisting a request', () => {
    const preferences = { weeklyEnabled: true, monthlyEnabled: true, quietEnabled: true, deliveryMinute: 540, quietStartMinute: 1380, quietEndMinute: 420, version: 2 };
    const fields = { weeklyEnabled: true, monthlyEnabled: true, quietEnabled: true, deliveryTime: '10:15', quietStartTime: '23:00', quietEndTime: '07:00' };
    expect(reportPreferenceCommand(preferences, fields)).toMatchObject({ expectedVersion: 2, deliveryMinute: 615 });
    expect(reportPreferenceCommand(preferences, { ...fields, deliveryTime: '25:00' })).toBeNull();
    expect(reportPreferenceCommand(preferences, { ...fields, deliveryTime: '23:00' })).toBeNull();
  });
  it('counts only explicit local answers inside the report period', () => {
    const state = freshWellness('owner');
    state.days = [{ date: '2026-09-06', answers: { [ReminderKind.Water]: ChecklistAnswer.Done } }, { date: '2026-09-07', answers: { [ReminderKind.Water]: ChecklistAnswer.Skipped } }];
    const rows = reportWellnessRows(state, '2026-08-31', '2026-09-06', (key) => key);
    expect(rows.find((row) => row.kind === ReminderKind.Water)?.recorded).toBe(1);
    expect(rows.find((row) => row.kind === ReminderKind.Break)?.recorded).toBe(0);
    expect(reportWellnessRows(state, '2026-08-01', '2026-08-31', (key) => key).every((row) => row.recorded === 0)).toBe(true);
  });
});
