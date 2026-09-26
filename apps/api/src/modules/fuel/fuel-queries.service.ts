import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { FuelView, businessDay, addCalendarDays } from '@ehsbha/shared-types';
import { ListFuelSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { nextRecordCursor, recordCursorScope, recordPosition } from '../../common/pagination/record-cursor';
import { nextVersionCursor, versionPosition } from '../../common/pagination/version-cursor';
import { computeFuelEfficiency } from '../analytics/engines/fuel.engine';
import { fuelSnapshot } from './fuel-history';
import { fuelResponse } from './fuel-response.mapper';
import { FUEL_EVIDENCE_RECORD_LIMIT } from './fuel.control';

export interface FuelHistoryQuery { cursor?: string; limit: number }
export interface FuelLinkableExpensesQuery extends FuelHistoryQuery { vehicleId: string; date: string; amountPiastres: number }
export interface FuelEfficiencyQuery { vehicleId: string; from: Date; to: Date }

@Injectable()
export class FuelQueriesService {
  constructor(private prisma: PrismaService) {}

  async list(driverId: string, q: z.infer<typeof ListFuelSchema>) {
    if (q.vehicleId) await this.assertVehicleOwned(driverId, q.vehicleId);
    const scope = recordCursorScope([driverId, q.vehicleId ?? '', 'fuel', q.view, q.from?.toISOString() ?? '', q.to?.toISOString() ?? '']);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.FuelLogWhereInput = { driverId, deletedAt: q.view === FuelView.Deleted ? { not: null } : null,
      ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}), dateTime: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } };
    const pageWhere = { ...where, ...(position ? { OR: [{ dateTime: { lt: position.timestamp } }, { dateTime: position.timestamp, id: { lt: position.id } }] } : {}) };
    const [rows, totals] = await this.prisma.$transaction([
      this.prisma.fuelLog.findMany({ where: pageWhere, orderBy: [{ dateTime: 'desc' }, { id: 'desc' }], take: q.limit + 1 }),
      this.prisma.fuelLog.aggregate({ where, _sum: { totalPiastres: true }, _count: true }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items: items.map(fuelResponse), summary: { recordCount: totals._count, totalPiastres: totals._sum.totalPiastres ?? 0 },
      nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.dateTime, id: last.id }, scope) : null };
  }

  async history(driverId: string, id: string, q: FuelHistoryQuery) {
    const record = await this.prisma.fuelLog.findFirst({ where: { driverId, id }, select: { id: true } });
    if (!record) throw new NotFoundException({ code: 'NOT_FOUND' });
    const scope = recordCursorScope([driverId, 'fuel-history', id]);
    const version = versionPosition(q.cursor ?? '', scope);
    const rows = await this.prisma.fuelRevision.findMany({ where: { driverId, recordId: id, ...(version ? { version: { lt: version } } : {}) }, orderBy: { version: 'desc' }, take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextVersionCursor(last.version, scope) : null };
  }

  async linkableExpenses(driverId: string, q: FuelLinkableExpensesQuery) {
    await this.assertVehicleOwned(driverId, q.vehicleId);
    const scope = recordCursorScope([driverId, q.vehicleId, 'fuel-expenses', q.date, String(q.amountPiastres)]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.ExpenseWhereInput = { driverId, deletedAt: null, category: 'OTHER', linkedTripId: null,
      amountPiastres: q.amountPiastres, OR: [{ vehicleId: null }, { vehicleId: q.vehicleId }],
      linkedMaintenance: { none: { deletedAt: null } }, linkedFuel: { none: { deletedAt: null } },
      dateTime: { gte: businessDay(addCalendarDays(q.date, -7)).start, lt: businessDay(addCalendarDays(q.date, 7)).end } };
    if (position) where.AND = [{ OR: [{ dateTime: { lt: position.timestamp } }, { dateTime: position.timestamp, id: { lt: position.id } }] }];
    const rows = await this.prisma.expense.findMany({ where, select: { id: true, vehicleId: true, dateTime: true, amountPiastres: true }, orderBy: [{ dateTime: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.dateTime, id: last.id }, scope) : null };
  }

  async efficiency(driverId: string, q: FuelEfficiencyQuery) {
    await this.assertVehicleOwned(driverId, q.vehicleId);
    const rows = await this.prisma.fuelLog.findMany({ where: { driverId, vehicleId: q.vehicleId, deletedAt: null,
      dateTime: { gte: q.from, lte: new Date(Math.min(q.to.getTime(), Date.now())) } }, orderBy: [{ dateTime: 'asc' }, { id: 'asc' }], take: FUEL_EVIDENCE_RECORD_LIMIT + 1 });
    const truncated = rows.length > FUEL_EVIDENCE_RECORD_LIMIT;
    const points = truncated ? [] : rows.map((row) => ({ ...fuelSnapshot(row), id: row.id, dateTime: row.dateTime }));
    const result = computeFuelEfficiency(points);
    return { ...result, vehicleId: q.vehicleId, recordCount: rows.length, from: result.from?.toISOString() ?? null,
      to: result.to?.toISOString() ?? null, requestedFrom: q.from.toISOString(), requestedTo: q.to.toISOString(), truncated };
  }

  private async assertVehicleOwned(driverId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { driverId, id: vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
}
