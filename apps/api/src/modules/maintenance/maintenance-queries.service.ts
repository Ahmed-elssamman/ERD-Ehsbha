import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { MaintenanceView, businessDay, addCalendarDays } from '@ehsbha/shared-types';
import { ListMaintenanceRecordsSchema, MaintenanceHistoryQuerySchema, MaintenanceLinkableExpensesQuerySchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { nextRecordCursor, recordCursorScope, recordPosition } from '../../common/pagination/record-cursor';
import { maintenanceHistoryPosition, nextMaintenanceHistoryCursor } from './maintenance-history';

export type ListMaintenanceRecordsDto = z.infer<typeof ListMaintenanceRecordsSchema>;
export type MaintenanceHistoryQuery = z.infer<typeof MaintenanceHistoryQuerySchema>;
export type MaintenanceLinkableExpensesQuery = z.infer<typeof MaintenanceLinkableExpensesQuerySchema>;

@Injectable()
export class MaintenanceQueriesService {
  constructor(private prisma: PrismaService) {}

  async list(driverId: string, vehicleId: string, q: ListMaintenanceRecordsDto) {
    await this.assertVehicleOwned(driverId, vehicleId);
    const scope = recordCursorScope([driverId, vehicleId, 'maintenance', q.view]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.MaintenanceRecordWhereInput = { driverId, vehicleId, deletedAt: q.view === MaintenanceView.Deleted ? { not: null } : null };
    if (position) where.OR = [{ performedAt: { lt: position.timestamp } }, { performedAt: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.maintenanceRecord.findMany({ where, include: { maintenanceItem: true }, orderBy: [{ performedAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.performedAt, id: last.id }, scope) : null };
  }

  async history(driverId: string, vehicleId: string, id: string, q: MaintenanceHistoryQuery) {
    const existing = await this.prisma.maintenanceRecord.findFirst({ where: { driverId, vehicleId, id }, select: { id: true } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const scope = recordCursorScope([driverId, vehicleId, 'maintenance-history', id]);
    const version = maintenanceHistoryPosition(q.cursor ?? '', scope);
    const rows = await this.prisma.maintenanceRevision.findMany({ where: { driverId, recordId: id, ...(version ? { version: { lt: version } } : {}) }, orderBy: { version: 'desc' }, take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextMaintenanceHistoryCursor(last.version, scope) : null };
  }

  async linkableExpenses(driverId: string, vehicleId: string, q: MaintenanceLinkableExpensesQuery) {
    await this.assertVehicleOwned(driverId, vehicleId);
    const scope = recordCursorScope([driverId, vehicleId, 'maintenance-expenses', q.date, String(q.amountPiastres)]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.ExpenseWhereInput = { driverId, deletedAt: null, category: 'OTHER', linkedTripId: null,
      amountPiastres: q.amountPiastres, OR: [{ vehicleId: null }, { vehicleId }], linkedMaintenance: { none: { deletedAt: null } }, linkedFuel: { none: { deletedAt: null } },
      dateTime: { gte: businessDay(addCalendarDays(q.date, -7)).start, lt: businessDay(addCalendarDays(q.date, 7)).end } };
    if (position) where.AND = [{ OR: [{ dateTime: { lt: position.timestamp } }, { dateTime: position.timestamp, id: { lt: position.id } }] }];
    const rows = await this.prisma.expense.findMany({ where, select: { id: true, vehicleId: true, dateTime: true, amountPiastres: true }, orderBy: [{ dateTime: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.dateTime, id: last.id }, scope) : null };
  }

  private async assertVehicleOwned(driverId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { driverId, id: vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
}
