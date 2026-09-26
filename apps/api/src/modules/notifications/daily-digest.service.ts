import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { businessDate, DRIVER_TIME_ZONE, NotificationKind } from '@ehsbha/shared-types';
import { currentDailyDigestDataSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { AggregatesService } from '../aggregates/aggregates.service';
import { digestEventKey, digestIsDue, NOTIFICATION_SCAN_SIZE } from './notifications.control';
import { readNotificationPreferences } from './notification-preferences.service';
import { digestHasEvidence, readDigestSnapshot } from './digest-insights';
import { digestMessage } from './digest-message.control';

interface DigestDriver { id: string }

@Injectable()
export class DailyDigestService {
  private logger = new Logger(DailyDigestService.name);
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  @Cron('*/15 * * * *', { name: 'daily-digest', timeZone: DRIVER_TIME_ZONE, waitForCompletion: true })
  async runForAllDrivers(): Promise<void> {
    let after: string | null = null, checked = 0, failed = 0;
    const eventKey = digestEventKey(new Date());
    while (true) {
      const drivers: DigestDriver[] = await this.prisma.driver.findMany({ where: { ...(after ? { id: { gt: after } } : {}), user: { status: 'ACTIVE' },
        notifications: { none: { eventKey } }, OR: [{ notificationPreferences: { is: null } }, { notificationPreferences: { is: { digestEnabled: true } } }] },
        select: { id: true }, orderBy: { id: 'asc' }, take: NOTIFICATION_SCAN_SIZE });
      for (const driver of drivers) {
        try { await this.generateForDriver(driver.id, true); } catch { failed++; }
        checked++;
      }
      after = drivers.at(-1)?.id ?? null;
      if (drivers.length < NOTIFICATION_SCAN_SIZE || after === null) break;
    }
    this.logger.log(`Digest scan complete: checked=${checked}, failed=${failed}`);
  }

  /** Manual generation is on demand; scheduled generation obeys preferences. Both share one Cairo-day identity. */
  async generateForDriver(driverId: string, scheduled = false, verificationTime: Date | null = null): Promise<string | null> {
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const now = verificationTime ?? new Date(), eventKey = digestEventKey(now);
      const driver = await tx.driver.findFirst({ where: { id: driverId, user: { status: 'ACTIVE' } }, select: { user: { select: { locale: true } } } });
      if (!driver) return null;
      const existing = await tx.notification.findUnique({ where: { driverId_eventKey: { driverId, eventKey } } });
      if (existing) return existing.id;
      if (scheduled) {
        const preferences = await readNotificationPreferences(tx, driverId);
        const latest = await tx.notification.findFirst({ where: { driverId, kind: NotificationKind.DailyDigest, eventDate: { not: null } }, orderBy: [{ eventDate: 'desc' }, { id: 'desc' }], select: { eventDate: true } });
        if (!digestIsDue(preferences, latest?.eventDate ?? null, now)) return null;
      }
      const snapshot = await readDigestSnapshot(tx, driverId, now);
      if (!digestHasEvidence(snapshot)) return null;
      const locale = driver.user.locale === 'ar' ? 'ar' : 'en';
      const message = digestMessage(snapshot, locale);
      const row = await tx.notification.create({ data: { driverId, kind: NotificationKind.DailyDigest, channel: 'INAPP', eventKey, eventDate: businessDate(now),
        title: message.title, body: message.body, data: currentDailyDigestDataSchema.parse(snapshot), sentAt: now } });
      return row.id;
    }, { timeout: 15_000 });
  }
}
