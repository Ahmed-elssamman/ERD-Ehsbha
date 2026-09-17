import { validateFuelExpense } from '../fuel/fuel-links';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Prisma, type Expense } from '@prisma/client';
import { ExpenseChange, ExpenseView, businessDay, addCalendarDays, DRIVER_TIME_ZONE } from '@ehsbha/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { assertDriverReferences } from '../../common/authorization/driver-ownership';
import { assertMutationMatches } from '../../common/utils/mutation-payload';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { CreateExpenseSchema, UpdateExpenseSchema, ListExpensesSchema, ExpenseSummaryQuerySchema, ExpenseHistoryQuerySchema, ExpenseLinkableTripsQuerySchema } from '@ehsbha/api-contracts';
import { recordCursorScope, recordPosition, nextRecordCursor } from '../../common/pagination/record-cursor';
import { validateExpenseLink } from './expense-links';
import { validateMaintenanceExpense } from '../maintenance/maintenance-links';
import { recordExpenseChange } from './expense-history';
export { CreateExpenseSchema, UpdateExpenseSchema, ListExpensesSchema, ExpenseSummaryQuerySchema, ExpenseHistoryQuerySchema, ExpenseLinkableTripsQuerySchema };
export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseSchema>;
export type ListExpensesDto = z.infer<typeof ListExpensesSchema>;
export type ExpenseSummaryQuery = z.infer<typeof ExpenseSummaryQuerySchema>;
export type ExpenseHistoryQuery = z.infer<typeof ExpenseHistoryQuerySchema>;
export type ExpenseLinkableTripsQuery = z.infer<typeof ExpenseLinkableTripsQuerySchema>;

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async list(driverId: string, q: ListExpensesDto) {
    const scope = recordCursorScope([driverId, 'expenses', q.from?.toISOString() ?? '', q.to?.toISOString() ?? '', q.category ?? '', q.view]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.ExpenseWhereInput = { driverId, deletedAt: q.view === ExpenseView.Deleted ? { not: null } : null };
    if (q.from || q.to) where.dateTime = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    if (q.category) where.category = q.category;
    if (position) where.OR = [{ dateTime: { lt: position.timestamp } }, { dateTime: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.expense.findMany({ where, orderBy: [{ dateTime: 'desc' }, { id: 'desc' }], take: q.limit + 1, include: { linkedFuel: { where: { deletedAt: null }, select: { id: true, vehicleId: true } }, linkedMaintenance: { where: { deletedAt: null }, select: { id: true, vehicleId: true } } } });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.dateTime, id: last.id }, scope) : null };
  }

  async summary(driverId: string, q: ExpenseSummaryQuery) {
    const rows = await this.prisma.expense.groupBy({ by: ['category'], where: { driverId, deletedAt: null,
      dateTime: { gte: businessDay(q.from).start, lt: businessDay(q.to).end } },
      _sum: { amountPiastres: true }, _count: { _all: true, linkedTripId: true } });
    const byCategory = rows.map((row) => ({ category: row.category, amountPiastres: row._sum.amountPiastres ?? 0, count: row._count._all }))
      .sort((a, b) => b.amountPiastres - a.amountPiastres || a.category.localeCompare(b.category));
    const totalPiastres = byCategory.reduce((sum, row) => sum + row.amountPiastres, 0);
    if (!Number.isSafeInteger(totalPiastres)) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
    return { from: q.from, to: q.to, timeZone: DRIVER_TIME_ZONE, totalPiastres,
      recordCount: rows.reduce((sum, row) => sum + row._count._all, 0), linkedCount: rows.reduce((sum, row) => sum + row._count.linkedTripId, 0), byCategory };
  }

  async history(driverId: string, id: string, q: ExpenseHistoryQuery) {
    const existing = await this.prisma.expense.findFirst({ where: { id, driverId }, select: { id: true } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const scope = recordCursorScope([driverId, 'expense-history', id]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.ExpenseRevisionWhereInput = { driverId, expenseId: id };
    if (position) where.OR = [{ createdAt: { lt: position.timestamp } }, { createdAt: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.expenseRevision.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.createdAt, id: last.id }, scope) : null };
  }

  async linkableTrips(driverId: string, q: ExpenseLinkableTripsQuery) {
    const scope = recordCursorScope([driverId, 'expense-trips', q.date, q.category, String(q.amountPiastres)]);
    const position = recordPosition(q.cursor ?? '', scope);
    const where: Prisma.TripWhereInput = { driverId, deletedAt: null,
      startedAt: { gte: businessDay(addCalendarDays(q.date, -7)).start, lt: businessDay(addCalendarDays(q.date, 7)).end },
      linkedExpenses: { none: { deletedAt: null, category: q.category } },
      ...(q.category === 'TOLL' ? { tollPiastres: q.amountPiastres } : { parkingPiastres: q.amountPiastres }) };
    if (position) where.OR = [{ startedAt: { lt: position.timestamp } }, { startedAt: position.timestamp, id: { lt: position.id } }];
    const rows = await this.prisma.trip.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: q.limit + 1,
      select: { id: true, vehicleId: true, startedAt: true, tollPiastres: true, parkingPiastres: true, driverApp: { select: { customName: true, appSource: { select: { name: true } } } } } });
    const selected = rows.slice(0, q.limit);
    const last = selected.at(-1);
    return { items: selected.map((row) => ({ id: row.id, vehicleId: row.vehicleId, startedAt: row.startedAt,
      feePiastres: q.category === 'TOLL' ? row.tollPiastres : row.parkingPiastres, appName: row.driverApp.customName ?? row.driverApp.appSource.name })),
      nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.startedAt, id: last.id }, scope) : null };
  }

  async create(driverId: string, dto: CreateExpenseDto) {
    return this.prisma.$transaction((tx) => this.createInTransaction(tx, driverId, dto), { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async createInTransaction(tx: Prisma.TransactionClient, driverId: string, dto: CreateExpenseDto): Promise<Expense> {
    await lockDriverWrites(tx, driverId);
    await assertDriverReferences(tx, driverId, dto);
    if (dto.clientMutationId) {
      const duplicate = await tx.expense.findUnique({ where: { driverId_clientMutationId: { driverId, clientMutationId: dto.clientMutationId } } });
      if (duplicate) { assertMutationMatches(dto, duplicate); return duplicate; }
    }
    await validateExpenseLink(tx, driverId, { ...dto, vehicleId: dto.vehicleId ?? null, linkedTripId: dto.linkedTripId ?? null });
    const created = await tx.expense.create({ data: { driverId, vehicleId: dto.vehicleId ?? null, category: dto.category,
      amountPiastres: dto.amountPiastres, dateTime: dto.dateTime, linkedTripId: dto.linkedTripId ?? null, isRecurring: dto.isRecurring,
      recurrenceRule: dto.recurrenceRule ?? null, notes: dto.notes ?? null, clientMutationId: dto.clientMutationId ?? null } });
    await this.refresh(tx, driverId, [created]);
    await recordExpenseChange(tx, created, ExpenseChange.Created);
    return created;
  }

  async update(driverId: string, id: string, dto: UpdateExpenseDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.expense.findFirst({ where: { id, driverId, deletedAt: null } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      this.assertVersion(existing, dto.expectedVersion);
      if (dto.clientMutationId && dto.clientMutationId !== existing.clientMutationId) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
      await assertDriverReferences(tx, driverId, dto);
      const { clientMutationId: _mutation, expectedVersion: _version, ...changes } = dto;
      const next = { ...existing, ...changes };
      await validateExpenseLink(tx, driverId, next, existing.id, existing.linkedTripId);
      await validateMaintenanceExpense(tx, driverId, next);
      await validateFuelExpense(tx, driverId, next);
      const updated = await tx.expense.update({ where: { id }, data: { ...changes, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing, updated]);
      await recordExpenseChange(tx, updated, ExpenseChange.Updated, existing);
      return updated;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async remove(driverId: string, id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.expense.findFirst({ where: { id, driverId, deletedAt: null } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      this.assertVersion(existing, expectedVersion);
      const deleted = await tx.expense.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing]);
      await recordExpenseChange(tx, deleted, ExpenseChange.Deleted, existing);
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async restore(driverId: string, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.expense.findFirst({ where: { id, driverId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      this.assertVersion(existing, expectedVersion);
      if (!existing.deletedAt) return existing;
      await validateExpenseLink(tx, driverId, existing, id, existing.linkedTripId);
      await validateMaintenanceExpense(tx, driverId, existing);
      await validateFuelExpense(tx, driverId, existing);
      const restored = await tx.expense.update({ where: { id }, data: { deletedAt: null, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [restored]);
      await recordExpenseChange(tx, restored, ExpenseChange.Restored, existing);
      return restored;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  private assertVersion(expense: Expense, expectedVersion: number): void {
    if (expense.version !== expectedVersion) throw new ConflictException({ code: 'EXPENSE_VERSION_CONFLICT' });
  }

  private async refresh(tx: Prisma.TransactionClient, driverId: string, rows: Expense[]): Promise<void> {
    const linkedIds = [...new Set(rows.flatMap((row) => row.linkedTripId ? [row.linkedTripId] : []))];
    const trips = linkedIds.length ? await tx.trip.findMany({ where: { driverId, id: { in: linkedIds } }, select: { startedAt: true } }) : [];
    const maintenance = await tx.maintenanceRecord.findMany({ where: { driverId, linkedExpenseId: { in: rows.map((row) => row.id) }, deletedAt: null }, select: { performedAt: true } });
    const fuel = await tx.fuelLog.findMany({ where: { driverId, linkedExpenseId: { in: rows.map((row) => row.id) }, deletedAt: null }, select: { dateTime: true } });
    await this.aggregates.refreshInstants(driverId, [...fuel.map((row) => row.dateTime), ...rows.map((row) => row.dateTime), ...trips.map((trip) => trip.startedAt), ...maintenance.map((row) => row.performedAt)], tx);
  }
}
