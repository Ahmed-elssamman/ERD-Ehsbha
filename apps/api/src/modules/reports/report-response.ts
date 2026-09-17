import type { DriverReport, ReportRevision } from '@prisma/client';
import { reportContentSchema, reportSummarySchema, type ReportRecord, type ReportSummary } from '@ehsbha/api-contracts';

export interface ReportSummarySource { id: string; period: DriverReport['period']; startsOn: Date; endsOn: Date; version: number; capturedAt: Date; createdAt: Date }
export interface ReportRevisionSummary { version: number; createdAt: Date }
export function reportSummary(row: ReportSummarySource, revision: ReportRevisionSummary | null = null): ReportSummary {
  return reportSummarySchema.parse({ id: row.id, period: row.period, startsOn: row.startsOn.toISOString().slice(0, 10), endsOn: row.endsOn.toISOString().slice(0, 10),
    version: revision?.version ?? row.version, capturedAt: (revision?.createdAt ?? row.capturedAt).toISOString(), createdAt: row.createdAt.toISOString() });
}
export function reportResponse(row: DriverReport, revision: ReportRevision | null = null): ReportRecord {
  return { ...reportSummary(row, revision), content: reportContentSchema.parse(revision?.content ?? row.content) };
}
