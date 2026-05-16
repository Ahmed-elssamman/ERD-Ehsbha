import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
});
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;

export const ListNotificationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListNotificationsDto = z.infer<typeof ListNotificationsSchema>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(driverId: string, q: ListNotificationsDto) {
    const cursor = q.cursor ? { id: q.cursor } : undefined;
    const items = await this.prisma.notification.findMany({
      where: { driverId },
      orderBy: { sentAt: 'desc' },
      take: q.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
    const hasNext = items.length > q.limit;
    const page = hasNext ? items.slice(0, q.limit) : items;
    return { items: page, nextCursor: hasNext ? page[page.length - 1].id : null };
  }

  async markRead(driverId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, driverId } });
    if (!n) throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { lastUsedAt: new Date(), userId },
    });
  }

  async create(driverId: string, title: string, body: string, data?: Record<string, unknown>) {
    return this.prisma.notification.create({
      data: {
        driverId,
        channel: 'INAPP',
        title,
        body,
        data: (data ?? {}) as any,
      },
    });
  }
}
