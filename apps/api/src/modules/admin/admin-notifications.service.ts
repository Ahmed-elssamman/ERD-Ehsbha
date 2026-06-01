import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAlerts(cursor: string | undefined, limit: number, severity?: string, resolved?: boolean) {
    const where: Prisma.AdminAlertWhereInput = {
      ...(severity ? { severity } : {}),
      ...(typeof resolved === 'boolean'
        ? resolved
          ? { resolvedAt: { not: null } }
          : { resolvedAt: null }
        : {}),
    };
    const items = await this.prisma.adminAlert.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map((a) => ({
        id: a.id,
        code: a.code,
        severity: a.severity,
        title: a.title,
        body: a.body,
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async listUserNotifications(cursor: string | undefined, limit: number) {
    const items = await this.prisma.notification.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { sentAt: 'desc' },
      include: { driver: { include: { user: { select: { phone: true } } } } },
    });
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map((n) => ({
        id: n.id,
        channel: n.channel,
        title: n.title,
        body: n.body,
        sentAt: n.sentAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        driverId: n.driverId,
        driverPhone: n.driver.user.phone,
        driverDisplayName: n.driver.displayName,
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }
}
