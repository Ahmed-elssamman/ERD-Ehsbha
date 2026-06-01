import { Injectable } from '@nestjs/common';
import { TicketStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

@Injectable()
export class AdminBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  /** Bulk suspend/activate the user accounts behind a list of driverIds. */
  async setDriversUserStatus(
    actor: AuthenticatedAdmin,
    driverIds: string[],
    status: UserStatus,
    reason: string,
  ) {
    if (driverIds.length === 0) return { affected: 0 };
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, userId: true, user: { select: { id: true, phone: true, status: true } } },
    });
    if (drivers.length === 0) return { affected: 0 };

    const userIds = drivers.map((d) => d.userId);
    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { status },
    });
    if (status !== 'ACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const action = status === 'SUSPENDED' ? 'drivers.suspend' : status === 'ACTIVE' ? 'drivers.activate' : 'drivers.blacklist';
    await Promise.all(
      drivers.map((d) =>
        this.audit.record({
          actor,
          action,
          targetType: 'Driver',
          targetId: d.id,
          before: { userStatus: d.user.status },
          after: { userStatus: status },
          reason,
        }),
      ),
    );

    return { affected: drivers.length };
  }

  /** Soft-delete trips by setting deletedAt. */
  async softDeleteTrips(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.trip.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, driverId: true, deletedAt: true },
    });
    if (targets.length === 0) return { affected: 0 };

    const now = new Date();
    await this.prisma.trip.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { deletedAt: now },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'trips.delete',
          targetType: 'Trip',
          targetId: before.id,
          before,
          after: { ...before, deletedAt: now },
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Restore soft-deleted trips. */
  async restoreTrips(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.trip.findMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      select: { id: true, driverId: true, deletedAt: true },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.trip.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { deletedAt: null },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'trips.restore',
          targetType: 'Trip',
          targetId: before.id,
          before,
          after: { ...before, deletedAt: null },
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Hard-delete community posts. */
  async deleteCommunityPosts(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.communityPost.findMany({
      where: { id: { in: ids } },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.communityPost.deleteMany({
      where: { id: { in: targets.map((p) => p.id) } },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'community.delete',
          targetType: 'CommunityPost',
          targetId: before.id,
          before,
          after: null,
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Hard-delete platform reviews. */
  async deleteReviews(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.platformReview.findMany({
      where: { id: { in: ids } },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.platformReview.deleteMany({
      where: { id: { in: targets.map((r) => r.id) } },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'reviews.delete',
          targetType: 'PlatformReview',
          targetId: before.id,
          before,
          after: null,
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Bulk transition support tickets to a status (typically CLOSED). */
  async transitionTickets(
    actor: AuthenticatedAdmin,
    ids: string[],
    status: TicketStatus,
    reason: string,
  ) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.supportTicket.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, subject: true },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.supportTicket.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { status },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'support.transition',
          targetType: 'SupportTicket',
          targetId: before.id,
          before,
          after: { ...before, status },
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Hard-delete support tickets. */
  async deleteTickets(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.supportTicket.findMany({
      where: { id: { in: ids } },
    });
    if (targets.length === 0) return { affected: 0 };

    await this.prisma.supportTicket.deleteMany({
      where: { id: { in: targets.map((t) => t.id) } },
    });

    await Promise.all(
      targets.map((before) =>
        this.audit.record({
          actor,
          action: 'support.close',
          targetType: 'SupportTicket',
          targetId: before.id,
          before,
          after: null,
          reason,
        }),
      ),
    );

    return { affected: targets.length };
  }

  /** Hard-delete vehicles (only if they have no trips/fuel/maintenance). */
  async deleteVehicles(actor: AuthenticatedAdmin, ids: string[], reason: string) {
    if (ids.length === 0) return { affected: 0 };
    const targets = await this.prisma.vehicle.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { trips: true, fuelLogs: true, maintenanceRecords: true } } },
    });
    const safe = targets.filter(
      (v) => v._count.trips === 0 && v._count.fuelLogs === 0 && v._count.maintenanceRecords === 0,
    );
    if (safe.length === 0) return { affected: 0, skipped: targets.length };

    await this.prisma.vehicle.deleteMany({ where: { id: { in: safe.map((v) => v.id) } } });

    await Promise.all(
      safe.map((before) =>
        this.audit.record({
          actor,
          action: 'vehicles.delete',
          targetType: 'Vehicle',
          targetId: before.id,
          before,
          after: null,
          reason,
        }),
      ),
    );

    return { affected: safe.length, skipped: targets.length - safe.length };
  }
}
