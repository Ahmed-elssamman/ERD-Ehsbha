import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from '@ehsbha/api-contracts';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
// Shared notification schemas available via @ehsbha/api-contracts (notification schemas in communications.ts)

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
});
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;

/** @see {@link CursorQuerySchema} from `@ehsbha/api-contracts` for pagination shape (cursor, limit). */
export const ListNotificationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListNotificationsDto = z.infer<typeof ListNotificationsSchema>;

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a notification is not found for the given driver
 * - {@link GOVERNED_ERROR_REGISTRY.VALIDATION_ERROR} - when input data fails Zod validation
 */
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
