import { TripChange, TripChangeActor, type TripVersionTarget } from '@ehsbha/shared-types';
import { recordTripChange } from '../trips/trip-history';
import { validateLinkedTripFees } from '../expenses/expense-links';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';

@Injectable()
export class AdminBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private aggregates: AggregatesService,
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

  async softDeleteTrips(actor: AuthenticatedAdmin, items: TripVersionTarget[], reason: string) {
    return this.changeTripDeletion(actor, items, reason, new Date());
  }

  async restoreTrips(actor: AuthenticatedAdmin, items: TripVersionTarget[], reason: string) {
    return this.changeTripDeletion(actor, items, reason, null);
  }

  private async changeTripDeletion(actor: AuthenticatedAdmin, items: TripVersionTarget[], reason: string, deletedAt: Date | null) {
    if (!items.length) return { affected: 0 };
    const ids = items.map((item) => item.id);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.trip.findMany({ where: { id: { in: ids } }, select: { driverId: true } });
      const driverIds = [...new Set(rows.map((row) => row.driverId))].sort();
      for (const driverId of driverIds) await lockDriverWrites(tx, driverId);
      const records = await tx.trip.findMany({ where: { id: { in: ids } } });
      if (records.length !== items.length) throw new NotFoundException({ code: 'NOT_FOUND' });
      for (const target of items) {
        const record = records.find((trip) => trip.id === target.id);
        if (!record || record.version !== target.expectedVersion) throw new ConflictException({ code: 'TRIP_VERSION_CONFLICT' });
      }
      const targets = records.filter((record) => !!record.deletedAt !== !!deletedAt);
      for (const trip of targets) {
        if (!deletedAt) await validateLinkedTripFees(tx, trip.driverId, trip);
        const updated = await tx.trip.update({ where: { id: trip.id }, data: { deletedAt, version: { increment: 1 } } });
        await recordTripChange(tx, updated, deletedAt ? TripChange.Deleted : TripChange.Restored, trip, TripChangeActor.Admin);
        const before = { id: trip.id, driverId: trip.driverId, deletedAt: trip.deletedAt?.toISOString() ?? null, version: trip.version };
        await this.audit.record({ actor, action: deletedAt ? 'trips.delete' : 'trips.restore', targetType: 'Trip',
          targetId: trip.id, before, after: { ...before, deletedAt: deletedAt?.toISOString() ?? null, version: updated.version }, reason }, tx);
      }
      for (const driverId of driverIds) {
        const intervals = targets.filter((trip) => trip.driverId === driverId);
        if (intervals.length) await this.aggregates.refreshIntervals(driverId, intervals, tx);
      }
      return { affected: targets.length };
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
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
