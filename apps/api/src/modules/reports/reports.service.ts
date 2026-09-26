import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { businessDateKey, calendarDateValue, ReportMutation, reportPeriodRange, type ReportPeriod, type ReportPeriodRange } from '@ehsbha/shared-types';
import { reportContentSchema, type CreateReport, type ReportHistoryQuery, type ReportListQuery, type ReportRecord, type ReviseReport } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { findMutationReceipt, mutationFingerprint, saveMutationReceipt } from '../../common/operations/mutation-receipt';
import { recordCursorScope, recordPosition, nextRecordCursor } from '../../common/pagination/record-cursor';
import { AggregatesService } from '../aggregates/aggregates.service';
import { readReportContent } from './report-reader';
import { reportResponse, reportSummary } from './report-response';
import { reportHistoryCursor, reportHistoryPosition } from './report-history-cursor';
import { REPORT_SUMMARY_SELECT } from './reports.control';

export async function ownedReport(database: Prisma.TransactionClient, driverId: string, id: string) {
  const row = await database.driverReport.findFirst({ where: { driverId, id } });
  if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
  return row;
}
/** Must run under the driver's write lock. A prior capture is immutable until an explicit revision. */
export async function captureFirstReport(database: Prisma.TransactionClient, driverId: string, period: ReportPeriod, range: ReportPeriodRange, now: Date, requireActivity = false) {
  const startsOn = calendarDateValue(range.startsOn);
  const current = await database.driverReport.findUnique({ where: { driverId_period_startsOn: { driverId, period, startsOn } } });
  if (current) return current;
  const content = reportContentSchema.parse(await readReportContent(database, driverId, period, range));
  if (requireActivity && content.totals.recordedDays === 0) return null;
  const report = await database.driverReport.create({ data: { driverId, period, startsOn, endsOn: calendarDateValue(range.endsOn), content, createdAt: now, capturedAt: now } });
  await database.reportRevision.create({ data: { driverId, reportId: report.id, version: report.version, content, createdAt: now } });
  return report;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}
  async list(driverId: string, query: ReportListQuery) {
    const scope = recordCursorScope([driverId, 'reports', query.period ?? 'all']);
    const position = recordPosition(query.cursor ?? '', scope);
    const where: Prisma.DriverReportWhereInput = { driverId, ...(query.period ? { period: query.period } : {}) };
    if (position) where.OR = [{ createdAt: { lt: position.timestamp } }, { createdAt: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.driverReport.findMany({ where, select: REPORT_SUMMARY_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const items = rows.slice(0, query.limit), last = items.at(-1);
    return { items: items.map((row) => reportSummary(row)), nextCursor: rows.length > query.limit && last ? nextRecordCursor({ timestamp: last.createdAt, id: last.id }, scope) : null };
  }
  async get(driverId: string, id: string): Promise<ReportRecord> { return reportResponse(await ownedReport(this.prisma, driverId, id)); }
  async revision(driverId: string, id: string, version: number): Promise<ReportRecord> {
    const report = await ownedReport(this.prisma, driverId, id);
    const revision = await this.prisma.reportRevision.findFirst({ where: { driverId, reportId: id, version } });
    if (!revision) throw new NotFoundException({ code: 'NOT_FOUND' });
    return reportResponse(report, revision);
  }
  async history(driverId: string, id: string, query: ReportHistoryQuery) {
    const report = await this.prisma.driverReport.findFirst({ where: { driverId, id }, select: REPORT_SUMMARY_SELECT });
    if (!report) throw new NotFoundException({ code: 'NOT_FOUND' });
    const scope = recordCursorScope([driverId, id, 'report-revisions']);
    const version = reportHistoryPosition(query.cursor ?? '', scope);
    const rows = await this.prisma.reportRevision.findMany({ where: { driverId, reportId: id, ...(version ? { version: { lt: version } } : {}) }, select: { version: true, createdAt: true }, orderBy: { version: 'desc' }, take: query.limit + 1 });
    const items = rows.slice(0, query.limit), last = items.at(-1);
    return { items: items.map((row) => reportSummary(report, row)), nextCursor: rows.length > query.limit && last ? reportHistoryCursor(last.version, scope) : null };
  }
  async create(driverId: string, command: CreateReport): Promise<ReportRecord> {
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const hash = mutationFingerprint(ReportMutation.Create, command), receipt = await findMutationReceipt(tx, driverId, command.clientMutationId, hash);
      if (receipt) return reportResponse(await ownedReport(tx, driverId, receipt.recordId));
      const now = new Date();
      if (command.date > businessDateKey(now)) throw new BadRequestException({ code: 'REPORT_PERIOD_NOT_COMPLETE' });
      const range = reportPeriodRange(command.period, command.date);
      if (range.nextStartsOn > businessDateKey(now)) throw new BadRequestException({ code: 'REPORT_PERIOD_NOT_COMPLETE' });
      const report = await captureFirstReport(tx, driverId, command.period, range, now);
      if (!report) throw new NotFoundException({ code: 'NOT_FOUND' });
      await saveMutationReceipt(tx, driverId, command.clientMutationId, hash, report.id);
      return reportResponse(report);
    }, { timeout: 15000 });
  }
  async revise(driverId: string, id: string, command: ReviseReport): Promise<ReportRecord> {
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const hash = mutationFingerprint(ReportMutation.Revise, { id, ...command }), receipt = await findMutationReceipt(tx, driverId, command.clientMutationId, hash);
      if (receipt) return reportResponse(await ownedReport(tx, driverId, receipt.recordId));
      const current = await ownedReport(tx, driverId, id);
      if (current.version !== command.expectedVersion) throw new ConflictException({ code: 'REPORT_VERSION_CONFLICT' });
      const period = reportContentSchema.parse(current.content).period;
      const range = reportPeriodRange(period, current.startsOn.toISOString().slice(0, 10)), now = new Date();
      const content = reportContentSchema.parse(await readReportContent(tx, driverId, period, range)), version = current.version + 1;
      const report = await tx.driverReport.update({ where: { id }, data: { content, version, capturedAt: now } });
      await tx.reportRevision.create({ data: { driverId, reportId: id, version, content, createdAt: now } });
      await saveMutationReceipt(tx, driverId, command.clientMutationId, hash, id);
      return reportResponse(report);
    }, { timeout: 15000 });
  }
}
