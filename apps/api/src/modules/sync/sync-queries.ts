import { Prisma } from '@prisma/client';
import { SyncEntityKind } from '@ehsbha/shared-types';
import { syncTripSchema, syncExpenseSchema, syncSessionSchema, syncVehicleSchema, syncAreaSchema,
  syncDriverAppSchema, syncGoalSchema, syncRecommendationSchema, type SyncPage } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { fuelResponse } from '../fuel/fuel-response.mapper';
import { vehicleResponse } from '../vehicles/vehicle-response.mapper';
import { tripSnapshot } from '../trips/trip-history';
import { SYNC_ENTITY_ORDER } from './sync.control';
import type { SyncCursor } from './sync-cursor';

/** Finite upper bounds, not a snapshot of entity values across subsequent pages. */
export async function syncCeilings(prisma: PrismaService, driverId: string, now: Date): Promise<Array<string | null>> {
  const query = { where: { driverId }, orderBy: { id: Prisma.SortOrder.desc }, select: { id: true } };
  const rows = await prisma.$transaction([
    prisma.trip.findFirst(query), prisma.fuelLog.findFirst(query), prisma.expense.findFirst(query),
    prisma.session.findFirst(query), prisma.vehicle.findFirst(query), prisma.area.findFirst(query),
    prisma.driverApp.findFirst(query), prisma.goal.findFirst(query),
    prisma.recommendation.findFirst({ ...query, where: { driverId, dismissedAt: null, expiresAt: { gt: now } } }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return rows.map((row) => row?.id ?? null);
}

function timestamps(row: { createdAt: Date; updatedAt: Date }) {
  return { createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function readSyncPage(prisma: PrismaService, driverId: string, cursor: SyncCursor, take: number, now: Date): Promise<SyncPage> {
  const kind = SYNC_ENTITY_ORDER[cursor.family], ceiling = cursor.ceilings[cursor.family];
  // An empty family at cycle start stays empty until the next cycle.
  const query = { where: { driverId, id: { gt: cursor.after ?? '', lte: ceiling ?? '' } },
    orderBy: { id: Prisma.SortOrder.asc }, take };
  switch (kind) {
    case SyncEntityKind.Trips: {
      const rows = await prisma.trip.findMany(query);
      return { kind, items: rows.map((row) => syncTripSchema.strip().parse({ ...row, ...tripSnapshot(row), ...timestamps(row) })) };
    }
    case SyncEntityKind.Fuels:
      return { kind, items: (await prisma.fuelLog.findMany(query)).map(fuelResponse) };
    case SyncEntityKind.Expenses: {
      const rows = await prisma.expense.findMany(query);
      return { kind, items: rows.map((row) => syncExpenseSchema.strip().parse({ ...row, ...timestamps(row),
        dateTime: row.dateTime.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null })) };
    }
    case SyncEntityKind.Sessions: {
      const rows = await prisma.session.findMany(query);
      return { kind, items: rows.map((row) => syncSessionSchema.strip().parse({ ...row, ...timestamps(row),
        startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, deletedAt: row.deletedAt?.toISOString() ?? null })) };
    }
    case SyncEntityKind.Vehicles: {
      const rows = await prisma.vehicle.findMany(query);
      return { kind, items: rows.map((row) => syncVehicleSchema.strip().parse({ ...vehicleResponse(row), ...timestamps(row) })) };
    }
    case SyncEntityKind.Areas: {
      const rows = await prisma.area.findMany(query);
      return { kind, items: rows.map((row) => syncAreaSchema.strip().parse({ ...row, createdAt: row.createdAt.toISOString() })) };
    }
    case SyncEntityKind.DriverApps: {
      const rows = await prisma.driverApp.findMany({ ...query, include: { appSource: true } });
      return { kind, items: rows.map((row) => syncDriverAppSchema.strip().parse({ ...row, ...timestamps(row),
        commissionPct: row.commissionPct.toNumber(), appSource: { ...row.appSource, defaultCommissionPct: row.appSource.defaultCommissionPct.toNumber() } })) };
    }
    case SyncEntityKind.Goals: {
      const rows = await prisma.goal.findMany(query);
      return { kind, items: rows.map((row) => syncGoalSchema.strip().parse({ ...row, ...timestamps(row),
        startsOn: row.startsOn.toISOString(), endsOn: row.endsOn.toISOString() })) };
    }
    case SyncEntityKind.Recommendations: {
      const rows = await prisma.recommendation.findMany({ ...query, where: { ...query.where, dismissedAt: null, expiresAt: { gt: now } } });
      return { kind, items: rows.map((row) => syncRecommendationSchema.strip().parse({ ...row, score: row.score.toNumber(),
        generatedAt: row.generatedAt.toISOString(), expiresAt: row.expiresAt.toISOString(), dismissedAt: row.dismissedAt?.toISOString() ?? null })) };
    }
  }
}
