import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

interface ListInput {
  cursor?: string;
  limit: number;
  status?: UserStatus;
  search?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(input: ListInput) {
    const where: Prisma.UserWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { phone: { contains: input.search } },
              { email: { contains: input.search, mode: 'insensitive' } },
              { id: { equals: input.search } },
            ],
          }
        : {}),
    };

    const cursor = input.cursor ? { id: input.cursor } : undefined;
    const items = await this.prisma.user.findMany({
      where,
      take: input.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { driver: { select: { id: true } } },
    });

    const driverIds = items.map((u) => u.driver?.id).filter((x): x is string => !!x);
    const tripCounts = driverIds.length
      ? await this.prisma.trip.groupBy({
          by: ['driverId'],
          where: { driverId: { in: driverIds } },
          _count: { _all: true },
        })
      : [];
    const tripCountMap = new Map(tripCounts.map((t) => [t.driverId, t._count._all]));

    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;

    return {
      items: page.map((u) => ({
        id: u.id,
        phone: u.phone,
        email: u.email,
        status: u.status,
        locale: u.locale,
        isBlacklisted: false,
        driverId: u.driver?.id ?? null,
        tripCount: u.driver ? (tripCountMap.get(u.driver.id) ?? 0) : 0,
        createdAt: u.createdAt.toISOString(),
        lastActivityAt: null,
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            vehicles: { where: { isActive: true }, select: { id: true, type: true, make: true, model: true, year: true } },
            driverApps: { where: { enabled: true }, include: { appSource: { select: { code: true, name: true } } } },
            _count: { select: { trips: true, fuelLogs: true, expenses: true, maintenanceRecords: true } },
          },
        },
        _count: { select: { supportTickets: true, deviceTokens: true } },
      },
    });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return u;
  }

  async setStatus(actor: AuthenticatedAdmin, id: string, status: UserStatus, reason: string, reasonCode: string) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, phone: true, status: true },
    });
    if (!before) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const after = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, phone: true, status: true },
    });

    if (status !== 'ACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record({
      actor,
      action: status === 'SUSPENDED' ? 'users.suspend' : status === 'ACTIVE' ? 'users.activate' : 'users.delete',
      targetType: 'User',
      targetId: id,
      before,
      after,
      reason,
      reasonCode,
    });

    return after;
  }

  async bulkSetStatus(
    actor: AuthenticatedAdmin,
    ids: string[],
    status: UserStatus,
    reason: string,
    reasonCode: string,
  ) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, phone: true, status: true },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.user.updateMany({
      where: { id: { in: targets.map((u) => u.id) } },
      data: { status },
    });

    if (status !== 'ACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: { in: targets.map((u) => u.id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const action = status === 'SUSPENDED' ? 'users.suspend' : status === 'ACTIVE' ? 'users.activate' : 'users.delete';
    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action,
          targetType: 'User',
          targetId: before.id,
          before,
          after: { ...before, status },
          reason,
          reasonCode,
        }),
      ),
    );

    return { affected: targets.length };
  }
}
