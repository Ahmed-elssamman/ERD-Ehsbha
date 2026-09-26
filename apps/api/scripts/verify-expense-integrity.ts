import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ExpenseCategory, ExpenseChange, ExpenseView, calendarDateValue } from '@ehsbha/shared-types';
import { CreateTripSchema, CreateExpenseSchema, ListExpensesSchema, ExpenseHistoryQuerySchema, ExpenseLinkableTripsQuerySchema, expenseHistorySchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { AdminBulkService } from '../src/modules/admin/admin-bulk.service';
import { AdminAuditService } from '../src/modules/admin/audit.service';
import type { AuthenticatedAdmin } from '../src/modules/admin/admin.types';

class FailExpenseProjection extends AggregatesService {
  override async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await super.refreshDays(driverId, dates, tx);
    throw new Error('Injected expense projection failure');
  }
}

async function projections(database: PrismaClient, driverId: string) {
  const withoutTime = <T extends { updatedAt: Date }>(rows: T[]) => rows.map(({ updatedAt: _time, ...row }) => row);
  return {
    daily: withoutTime(await database.dailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } })),
    weekly: withoutTime(await database.weeklyAggregate.findMany({ where: { driverId }, orderBy: [{ isoYear: 'asc' }, { isoWeek: 'asc' }] })),
    monthly: withoutTime(await database.monthlyAggregate.findMany({ where: { driverId }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })),
    apps: withoutTime(await database.appDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { driverAppId: 'asc' }] })),
    areas: withoutTime(await database.areaDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { areaId: 'asc' }] })),
  };
}

export async function verifyExpenseIntegrity(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [
    { provide: PrismaService, useValue: database }, AggregatesService, TripsService, ExpensesService, AdminBulkService, AdminAuditService,
  ] }).compile();
  const expenses = module.get(ExpensesService);
  const trips = module.get(TripsService);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `expense-${suffix}`, name: 'Expense verification', isSystem: false } });
  const createUser = (name: string) => database.user.create({ data: { phone: `${name}-${suffix}`, passwordHash: 'unusable-test-password-hash',
    driver: { create: { displayName: 'Expense verification', vehicles: { create: [{ type: 'CAR', fuelType: 'PETROL_92' }, { type: 'CAR', fuelType: 'PETROL_92' }] },
      driverApps: { create: { appSourceId: source.id, commissionPct: 0 } }, areas: { create: { name: 'Expense area' } } } },
  }, include: { driver: { include: { vehicles: true, driverApps: true, areas: true } } } });
  const user = await createUser('expense-owner');
  const foreign = await createUser('expense-foreign');
  assert(user.driver && foreign.driver);
  const driver = user.driver;
  const other = foreign.driver;
  let adminId = '';
  const daily = (date: string) => database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: calendarDateValue(date) } } });
  const cost = CreateExpenseSchema.parse({ category: ExpenseCategory.Toll, amountPiastres: 1234, dateTime: '2026-10-01T08:00:00Z',
    vehicleId: driver.vehicles[0].id, notes: 'Private notes must not enter financial history' });
  try {
    const trip = await trips.create(driver.id, CreateTripSchema.parse({ vehicleId: driver.vehicles[0].id, driverAppId: driver.driverApps[0].id,
      areaId: driver.areas[0].id, startedAt: '2026-09-30T20:30:00Z', endedAt: '2026-09-30T20:50:00Z',
      earningsPiastres: 10000, tollPiastres: 1234, parkingPiastres: 432, totalKmMeters: 10000, paidKmMeters: 8000 }));
    let expense = await expenses.create(driver.id, cost);
    assert.equal((await daily('2026-09-30')).expensePiastres + (await daily('2026-10-01')).expensePiastres, 2900n, 'Equal amounts do not deduplicate distinct payments');
    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, linkedTripId: trip.id });
    assert.equal((await daily('2026-09-30')).expensePiastres, 432n);
    assert.equal((await daily('2026-10-01')).expensePiastres, 1234n);
    const linked = await projections(database, driver.id);
    assert.equal(linked.weekly.reduce((sum, row) => sum + row.expensePiastres, 0n), 1666n);
    assert.equal(linked.monthly.reduce((sum, row) => sum + row.expensePiastres, 0n), 1666n);
    assert.equal(linked.apps.reduce((sum, row) => sum + row.netProfitPiastres, 0n), 8334n, 'Platform comparison retains trip fees on the trip date');
    assert.equal(linked.areas.reduce((sum, row) => sum + row.netProfitPiastres, 0n), 8334n);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: 1, amountPiastres: 2000 }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, amountPiastres: 2000 }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, category: ExpenseCategory.Phone }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, vehicleId: driver.vehicles[1].id }), ConflictException);
    await assert.rejects(trips.update(driver.id, trip.id, { expectedVersion: trip.version, tollPiastres: 2000 }), ConflictException);
    await assert.rejects(trips.update(driver.id, trip.id, { expectedVersion: trip.version, vehicleId: driver.vehicles[1].id }), ConflictException);
    await assert.rejects(expenses.create(driver.id, { ...cost, linkedTripId: trip.id }), ConflictException);
    await assert.rejects(expenses.create(other.id, { ...cost, vehicleId: other.vehicles[0].id, linkedTripId: trip.id }), NotFoundException);
    await assert.rejects(expenses.history(other.id, expense.id, ExpenseHistoryQuerySchema.parse({})), NotFoundException);
    await assert.rejects(expenses.remove(other.id, expense.id, expense.version), NotFoundException);
    await assert.rejects(database.expense.create({ data: { driverId: other.id, category: 'TOLL', amountPiastres: 1234, dateTime: cost.dateTime, linkedTripId: trip.id } }));
    await assert.rejects(database.expense.create({ data: { driverId: driver.id, category: 'TOLL', amountPiastres: 1234, dateTime: cost.dateTime, linkedTripId: trip.id } }));
    assert.deepEqual(await projections(database, driver.id), linked, 'Rejected changes preserve all five projections');

    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, linkedTripId: null });
    assert.equal((await daily('2026-09-30')).expensePiastres, 1666n);
    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, linkedTripId: trip.id, dateTime: new Date('2026-10-05T08:00:00Z') });
    assert.equal((await daily('2026-10-01')).expensePiastres, 0n);
    assert.equal((await daily('2026-10-05')).expensePiastres, 1234n);
    assert.deepEqual((await projections(database, driver.id)).weekly.map((row) => row.expensePiastres), [432n, 1234n], 'Moving a linked expense reconciles both reporting weeks');
    await assert.rejects(expenses.remove(driver.id, expense.id, expense.version - 1), ConflictException);
    await expenses.remove(driver.id, expense.id, expense.version);
    assert.equal((await daily('2026-09-30')).expensePiastres, 1666n);
    assert.equal((await daily('2026-10-05')).expensePiastres, 0n);
    assert.equal((await expenses.summary(driver.id, { from: '2026-10-01', to: '2026-10-31' })).recordCount, 0);
    const deleted = (await expenses.list(driver.id, ListExpensesSchema.parse({ view: ExpenseView.Deleted }))).items;
    assert.equal(deleted[0].id, expense.id);
    await assert.rejects(expenses.restore(driver.id, expense.id, expense.version), ConflictException);
    expense = await expenses.restore(driver.id, expense.id, deleted[0].version);
    assert.equal((await daily('2026-09-30')).expensePiastres, 432n);
    await trips.remove(driver.id, trip.id, trip.version);
    assert((await database.trip.findUniqueOrThrow({ where: { id: trip.id } })).deletedAt);
    assert.equal((await daily('2026-09-30')).expensePiastres, 0n);
    assert.equal((await daily('2026-10-05')).expensePiastres, 1234n, 'Deleting a trip preserves the independently recorded expense');
    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, notes: 'Another private note' });
    const admin = await database.adminUser.create({ data: { email: `expense-${suffix}@example.test`, displayName: 'Expense test', passwordHash: 'unusable-test-password-hash' } });
    adminId = admin.id;
    const actor: AuthenticatedAdmin = { id: admin.id, email: admin.email, displayName: admin.displayName,
      roles: [], permissions: [], permissionsVersion: 1, mfaPassed: true };
    await module.get(AdminBulkService).restoreTrips(actor, [{ id: trip.id, expectedVersion: trip.version + 1 }], 'Expense link restoration verification');
    assert.equal((await daily('2026-09-30')).expensePiastres, 432n);
    await trips.update(driver.id, trip.id, { expectedVersion: trip.version + 2, startedAt: new Date('2026-11-05T10:00:00Z'), endedAt: new Date('2026-11-05T10:20:00Z') });
    assert.equal((await daily('2026-09-30')).expensePiastres, 0n);
    assert.equal((await daily('2026-11-05')).expensePiastres, 432n);
    assert.equal((await daily('2026-10-05')).expensePiastres, 1234n, 'Moving the trip does not move its linked expense');
    await trips.update(driver.id, trip.id, { expectedVersion: trip.version + 3, startedAt: trip.startedAt, endedAt: trip.endedAt });

    const beforeFailure = await projections(database, driver.id);
    const revisionCount = await database.expenseRevision.count({ where: { expenseId: expense.id } });
    const prisma = module.get(PrismaService);
    const failing = new ExpensesService(prisma, new FailExpenseProjection(prisma));
    await assert.rejects(failing.update(driver.id, expense.id, { expectedVersion: expense.version, dateTime: new Date('2026-11-01') }), /Injected expense/);
    assert.deepEqual(await database.expense.findUniqueOrThrow({ where: { id: expense.id } }), expense);
    assert.deepEqual(await projections(database, driver.id), beforeFailure);
    assert.equal(await database.expenseRevision.count({ where: { expenseId: expense.id } }), revisionCount);
    const history = await expenses.history(driver.id, expense.id, ExpenseHistoryQuerySchema.parse({ limit: 100 }));
    const wireHistory = expenseHistorySchema.parse(JSON.parse(JSON.stringify(history)));
    assert.equal(wireHistory.items.length, expense.version);
    assert.equal(wireHistory.items.filter((row) => row.action === ExpenseChange.Deleted).length, 1);
    assert.equal(wireHistory.items.filter((row) => row.action === ExpenseChange.Restored).length, 1);
    assert(!JSON.stringify(wireHistory).includes('private'));
    assert(!JSON.stringify(wireHistory).includes('notes'));
    for (const revision of wireHistory.items) if (revision.before) assert.equal(revision.after.version, revision.before.version + 1);

    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, linkedTripId: null });
    const competitors = await Promise.allSettled([
      expenses.update(driver.id, expense.id, { expectedVersion: expense.version, linkedTripId: trip.id }),
      expenses.create(driver.id, { ...cost, linkedTripId: trip.id }),
    ]);
    assert.equal(competitors.filter((result) => result.status === 'fulfilled').length, 1);
    const candidates = await expenses.linkableTrips(driver.id, ExpenseLinkableTripsQuerySchema.parse({ date: '2026-09-30', category: ExpenseCategory.Toll, amountPiastres: 1234 }));
    assert.equal(candidates.items.length, 0, 'Already linked fees are unavailable');
    const parking = await expenses.linkableTrips(driver.id, ExpenseLinkableTripsQuerySchema.parse({ date: '2026-09-30', category: ExpenseCategory.Parking, amountPiastres: 432 }));
    assert.equal(parking.items[0].id, trip.id, 'A separate parking fee remains linkable');

    const tiedAt = new Date('2026-12-15T10:00:00Z');
    await database.expense.createMany({ data: Array.from({ length: 1003 }, (_, index) => ({ driverId: driver.id, category: ExpenseCategory.Phone, amountPiastres: 100 + index, dateTime: tiedAt })) });
    await database.expense.create({ data: { driverId: other.id, category: ExpenseCategory.Phone, amountPiastres: 999999, dateTime: tiedAt } });
    const filters = { from: new Date('2026-12-01'), to: new Date('2026-12-31T23:59:59Z'), category: ExpenseCategory.Phone };
    const first = await expenses.list(driver.id, ListExpensesSchema.parse({ ...filters, limit: 25 }));
    assert.equal(first.items.length, 25);
    assert(first.nextCursor);
    await assert.rejects(expenses.list(other.id, ListExpensesSchema.parse({ ...filters, cursor: first.nextCursor })), BadRequestException);
    await assert.rejects(expenses.list(driver.id, ListExpensesSchema.parse({ ...filters, view: ExpenseView.Deleted, cursor: first.nextCursor })), BadRequestException);
    await assert.rejects(expenses.list(driver.id, ListExpensesSchema.parse({ ...filters, cursor: 'malformed' })), BadRequestException);
    const ids = new Set(first.items.map((row) => row.id));
    await expenses.remove(driver.id, first.items[24].id, first.items[24].version);
    let cursor: string | null = first.nextCursor;
    while (cursor) {
      const page = await expenses.list(driver.id, ListExpensesSchema.parse({ ...filters, cursor, limit: 100 }));
      for (const row of page.items) { assert(!ids.has(row.id), 'Tied-date pagination never repeats a record'); ids.add(row.id); }
      cursor = page.nextCursor;
    }
    assert.equal(ids.size, 1003, 'Deleting the cursor row does not hide older records');
    const expectedTotal = 1003 * 100 + (1002 * 1003) / 2 - first.items[24].amountPiastres;
    const summary = await expenses.summary(driver.id, { from: '2026-12-01', to: '2026-12-31' });
    assert.equal(summary.recordCount, 1002);
    assert.equal(summary.totalPiastres, expectedTotal);
    assert.equal(summary.byCategory[0].count, 1002);
    const timings: number[] = [];
    for (let index = 0; index < 20; index++) {
      const start = performance.now();
      await expenses.summary(driver.id, { from: '2026-12-01', to: '2026-12-31' });
      await expenses.list(driver.id, ListExpensesSchema.parse(filters));
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    process.stdout.write(JSON.stringify({ expenseReadBenchmark: { records: 1002, iterations: 20, summaryAndPageP95Ms: timings[18] } }) + '\n');
    assert(timings[18] < 300, 'Complete summary and bounded page stay within the local read budget');
  } finally {
    await database.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    assert.equal(await database.expenseRevision.count({ where: { driverId: driver.id } }), 0, 'Account deletion clears retained financial history');
    if (adminId) { await database.adminAuditLog.deleteMany({ where: { actorAdminId: adminId } }); await database.adminUser.delete({ where: { id: adminId } }); }
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
