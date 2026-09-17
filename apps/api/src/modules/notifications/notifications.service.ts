import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListNotificationsSchema, RegisterDeviceSchema } from '@ehsbha/api-contracts';
import { Prisma } from '@prisma/client';
import type { DevicePlatform } from '@ehsbha/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { recordCursorScope, recordPosition, nextRecordCursor } from '../../common/pagination/record-cursor';
import { notificationResponse } from './notification-response';

export { ListNotificationsSchema, RegisterDeviceSchema };
export interface ListNotificationsDto { cursor?: string; limit: number }
export interface RegisterDeviceDto { token: string; platform: DevicePlatform }

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(driverId: string, query: ListNotificationsDto) {
    const scope = recordCursorScope([driverId, 'notifications']);
    const position = recordPosition(query.cursor ?? '', scope);
    const where: Prisma.NotificationWhereInput = { driverId };
    if (position) where.OR = [{ sentAt: { lt: position.timestamp } }, { sentAt: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.notification.findMany({ where, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const items = rows.slice(0, query.limit), last = items.at(-1);
    return { items: items.map(notificationResponse), nextCursor: rows.length > query.limit && last ? nextRecordCursor({ timestamp: last.sentAt, id: last.id }, scope) : null };
  }

  async markRead(driverId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, driverId, readAt: null }, data: { readAt: new Date() } });
    const row = await this.prisma.notification.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    return notificationResponse(row);
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const existing = await tx.deviceToken.findUnique({ where: { token: dto.token } });
        if (existing && existing.userId !== userId) throw new ConflictException({ code: 'CONFLICT' });
        if (existing) return tx.deviceToken.update({ where: { id: existing.id }, data: { lastUsedAt: new Date(), platform: dto.platform } });
        return tx.deviceToken.create({ data: { userId, token: dto.token, platform: dto.platform } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ code: 'CONFLICT' });
      throw error;
    }
  }
}
