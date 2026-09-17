import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { businessDate, DRIVER_TIME_ZONE, lastCompletedReportRange, NotificationKind, ReportPeriod } from '@ehsbha/shared-types';
import { reportContentSchema, reportReadyDataSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { AggregatesService } from '../aggregates/aggregates.service';
import { captureFirstReport } from './reports.service';
import { readReportPreferences } from './report-preferences.service';
import { reportDeliveryDue, reportEventKey, REPORT_PERIODS, REPORT_SCAN_SIZE } from './reports.control';
import { reportMessage } from './report-message.control';

interface ReportDriver { id: string }

@Injectable()
export class ReportDeliveryService {
  private logger = new Logger(ReportDeliveryService.name);
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  @Cron('*/15 * * * *', { name: 'automatic-reports', timeZone: DRIVER_TIME_ZONE, waitForCompletion: true })
  async runForAllDrivers(): Promise<void> {
    let checked = 0, failed = 0;
    for (const period of REPORT_PERIODS) {
      let after: string | null = null;
      const eventKey = reportEventKey(period, lastCompletedReportRange(period, new Date()).startsOn);
      while (true) {
        const drivers: ReportDriver[] = await this.prisma.driver.findMany({
          where: { ...(after ? { id: { gt: after } } : {}), user: { status: 'ACTIVE' }, notifications: { none: { eventKey } },
            OR: [{ reportPreferences: { is: null } }, { reportPreferences: { is: period === ReportPeriod.Weekly ? { weeklyEnabled: true } : { monthlyEnabled: true } } }] },
          select: { id: true }, orderBy: { id: 'asc' }, take: REPORT_SCAN_SIZE,
        });
        for (const driver of drivers) {
          try { await this.deliver(driver.id, period); } catch { failed++; }
          checked++;
        }
        after = drivers.at(-1)?.id ?? null;
        if (drivers.length < REPORT_SCAN_SIZE || after === null) break;
      }
    }
    this.logger.log(`Report scan complete: checked=${checked}, failed=${failed}`);
  }

  async deliver(driverId: string, period: ReportPeriod, verificationTime: Date | null = null): Promise<string | null> {
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const now = verificationTime ?? new Date(), range = lastCompletedReportRange(period, now), eventKey = reportEventKey(period, range.startsOn);
      const driver = await tx.driver.findFirst({ where: { id: driverId, user: { status: 'ACTIVE' } }, select: { user: { select: { locale: true } } } });
      if (!driver) return null;
      const existing = await tx.notification.findUnique({ where: { driverId_eventKey: { driverId, eventKey } }, select: { id: true } });
      if (existing) return existing.id;
      if (!reportDeliveryDue(await readReportPreferences(tx, driverId), period, now)) return null;
      const report = await captureFirstReport(tx, driverId, period, range, now, true);
      if (!report || reportContentSchema.parse(report.content).totals.recordedDays === 0) return null;
      const message = reportMessage(period, range.startsOn, range.endsOn, driver.user.locale);
      const data = reportReadyDataSchema.parse({ kind: NotificationKind.ReportReady, reportId: report.id, version: report.version, period, startsOn: range.startsOn, endsOn: range.endsOn });
      const notification = await tx.notification.create({ data: { driverId, kind: NotificationKind.ReportReady, channel: 'INAPP', eventKey, eventDate: businessDate(now),
        title: message.title, body: message.body, data, sentAt: now } });
      return notification.id;
    }, { timeout: 15000 });
  }
}
