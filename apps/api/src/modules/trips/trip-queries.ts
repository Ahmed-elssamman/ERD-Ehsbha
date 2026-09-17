import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TripView } from '@ehsbha/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { nextRecordCursor, recordCursorScope, recordPosition } from '../../common/pagination/record-cursor';
import { nextVersionCursor, versionPosition } from '../../common/pagination/version-cursor';
import { ListTripsDto } from './dto/trips.dto';

export interface TripHistoryQuery { cursor?: string; limit: number }
export async function listTripRecords(prisma: PrismaService, driverId: string, q: ListTripsDto) {
  const scope = recordCursorScope([driverId, 'trips', q.view, q.vehicleId ?? '', q.appId ?? '', q.areaId ?? '', q.from?.toISOString() ?? '', q.to?.toISOString() ?? '']);
  const position = recordPosition(q.cursor ?? '', scope);
  const where: Prisma.TripWhereInput = { driverId, deletedAt: q.view === TripView.Deleted ? { not: null } : null,
    ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}), ...(q.appId ? { driverAppId: q.appId } : {}), ...(q.areaId ? { areaId: q.areaId } : {}),
    startedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) },
    ...(position ? { OR: [{ startedAt: { lt: position.timestamp } }, { startedAt: position.timestamp, id: { lt: position.id } }] } : {}) };
  const rows = await prisma.trip.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
  const items = rows.slice(0, q.limit), last = items.at(-1);
  return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.startedAt, id: last.id }, scope) : null };
}
export async function tripHistory(prisma: PrismaService, driverId: string, id: string, q: TripHistoryQuery) {
  const record = await prisma.trip.findFirst({ where: { driverId, id }, select: { id: true } });
  if (!record) throw new NotFoundException({ code: 'NOT_FOUND' });
  const scope = recordCursorScope([driverId, 'trip-history', id]), version = versionPosition(q.cursor ?? '', scope);
  const rows = await prisma.tripRevision.findMany({ where: { driverId, recordId: id, ...(version ? { version: { lt: version } } : {}) },
    orderBy: { version: 'desc' }, take: q.limit + 1 });
  const items = rows.slice(0, q.limit).map((row) => ({ id: row.id, recordId: row.recordId, version: row.version,
    action: row.action, actor: row.actor, before: row.before, after: row.after, createdAt: row.createdAt.toISOString() })), last = items.at(-1);
  return { items, nextCursor: rows.length > q.limit && last ? nextVersionCursor(last.version, scope) : null };
}
