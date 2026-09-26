import { FINANCIAL_PROJECTION_VERSION } from '../src/modules/aggregates/aggregate.control';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ExpenseCategory, MaintenanceStatus, MaintenanceView, calendarDateValue } from '@ehsbha/shared-types';
import { CreateMaintenanceRecordSchema, CreateExpenseSchema, ListMaintenanceRecordsSchema, MaintenanceHistoryQuerySchema, MaintenanceLinkableExpensesQuerySchema, maintenanceHistorySchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { aggregateRepairDates } from '../src/modules/aggregates/aggregate-repair';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { MaintenanceQueriesService } from '../src/modules/maintenance/maintenance-queries.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';

class FailMaintenanceProjection extends AggregatesService {
  override async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await super.refreshDays(driverId, dates, tx);
    throw new Error('Injected maintenance projection failure');
  }
}
async function projections(database: PrismaClient, driverId: string) {
  const omitTime = <T extends { updatedAt: Date }>(rows: T[]) => rows.map(({ updatedAt: _time, ...row }) => row);
  return {
    daily: omitTime(await database.dailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } })),
    weekly: omitTime(await database.weeklyAggregate.findMany({ where: { driverId }, orderBy: [{ isoYear: 'asc' }, { isoWeek: 'asc' }] })),
    monthly: omitTime(await database.monthlyAggregate.findMany({ where: { driverId }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })),
    apps: omitTime(await database.appDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { driverAppId: 'asc' }] })),
    areas: omitTime(await database.areaDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { areaId: 'asc' }] })),
  };
}

export async function verifyMaintenanceIntegrity(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, AggregatesService,
    MaintenanceService, MaintenanceQueriesService, ExpensesService, AnalyticsService] }).compile();
  const service = module.get(MaintenanceService);
  const queries = module.get(MaintenanceQueriesService);
  const expenses = module.get(ExpensesService);
  const aggregates = module.get(AggregatesService);
  const suffix = randomUUID();
  const item = await database.maintenanceItem.create({ data: { code: `maintenance-${suffix}`, name: 'Integrity service', defaultIntervalKm: 10000, defaultIntervalDays: 180, appliesToBike: false } });
  const createUser = (name: string) => database.user.create({ data: { phone: `${name}-${suffix}`, passwordHash: 'unusable-test-password',
    driver: { create: { displayName: 'Maintenance verification', vehicles: { create: [{ type: 'CAR', fuelType: 'PETROL_92', odometerMeters: 1000000, odometerSource: 'MANUAL' }, { type: 'BIKE', fuelType: 'PETROL_92' }] } } } },
    include: { driver: { include: { vehicles: true } } } });
  const user = await createUser('maintenance-owner');
  const foreign = await createUser('maintenance-foreign');
  assert(user.driver && foreign.driver);
  const driver = user.driver;
  const other = foreign.driver;
  const vehicle = driver.vehicles.find((row) => row.type === 'CAR');
  const bike = driver.vehicles.find((row) => row.type === 'BIKE');
  assert(vehicle && bike);
  const otherCar = other.vehicles.find((row) => row.type === 'CAR');
  assert(otherCar);
  const daily = (date: string) => database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: calendarDateValue(date) } } });
  const body = CreateMaintenanceRecordSchema.parse({ maintenanceItemId: item.id, performedAt: '2026-08-31T20:30:00Z', odometerMeters: 500000, costPiastres: 1234, notes: 'Private service notes' });
  try {
    const unknown = (await service.risk(driver.id, vehicle.id)).find((row) => row.item.id === item.id);
    assert.equal(unknown?.status, MaintenanceStatus.Unknown);
    assert.equal(unknown?.kmSinceLastMeters, null);
    await assert.rejects(service.addRecord(driver.id, bike.id, body), BadRequestException);
    await assert.rejects(service.addRecord(driver.id, other.vehicles[0].id, body), NotFoundException);
    let record = await service.addRecord(driver.id, vehicle.id, { ...body, clientMutationId: suffix });
    assert.equal((await service.addRecord(driver.id, vehicle.id, { ...body, clientMutationId: suffix })).id, record.id);
    await assert.rejects(service.addRecord(driver.id, vehicle.id, { ...body, costPiastres: 99, clientMutationId: suffix }), ConflictException);
    assert.equal((await daily('2026-08-31')).maintenancePiastres, 1234n);
    assert.equal((await daily('2026-08-31')).netProfitPiastres, -1234n);
    let expense = await expenses.create(driver.id, CreateExpenseSchema.parse({ category: 'OTHER', amountPiastres: 1234, dateTime: '2026-09-01T08:00:00Z', vehicleId: vehicle.id }));
    assert.equal((await daily('2026-08-31')).netProfitPiastres + (await daily('2026-09-01')).netProfitPiastres, -2468n, 'Distinct equal payments count separately');
    const candidates = await queries.linkableExpenses(driver.id, vehicle.id, MaintenanceLinkableExpensesQuerySchema.parse({ amountPiastres: 1234, date: '2026-08-31' }));
    assert.equal(candidates.items[0].id, expense.id);
    record = await service.updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: record.version, linkedExpenseId: expense.id });
    assert.equal((await daily('2026-08-31')).maintenancePiastres, 0n);
    assert.equal((await daily('2026-09-01')).expensePiastres, 1234n);
    const linked = await projections(database, driver.id);
    assert.equal(linked.monthly.reduce((sum, row) => sum + row.netProfitPiastres, 0n), -1234n);
    assert.equal(linked.weekly.reduce((sum, row) => sum + row.netProfitPiastres, 0n), -1234n);
    await assert.rejects(service.updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: 1, notes: 'stale' }), ConflictException);
    await assert.rejects(service.updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: record.version, costPiastres: 900 }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, amountPiastres: 900 }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, category: ExpenseCategory.Phone }), ConflictException);
    await assert.rejects(expenses.update(driver.id, expense.id, { expectedVersion: expense.version, vehicleId: bike.id }), ConflictException);
    await assert.rejects(service.addRecord(driver.id, vehicle.id, { ...body, linkedExpenseId: expense.id }), ConflictException);
    await assert.rejects(service.addRecord(other.id, otherCar.id, { ...body, linkedExpenseId: expense.id }), NotFoundException);
    await assert.rejects(queries.history(other.id, vehicle.id, record.id, MaintenanceHistoryQuerySchema.parse({})), NotFoundException);
    await assert.rejects(database.maintenanceRecord.create({ data: { ...body, driverId: other.id, vehicleId: vehicle.id } }));
    await assert.rejects(database.maintenanceRecord.create({ data: { ...body, driverId: other.id, vehicleId: other.vehicles[0].id, linkedExpenseId: expense.id } }));
    await assert.rejects(database.maintenanceRecord.create({ data: { ...body, driverId: driver.id, vehicleId: vehicle.id, linkedExpenseId: expense.id } }));
    assert.deepEqual(await projections(database, driver.id), linked);
    expense = await expenses.update(driver.id, expense.id, { expectedVersion: expense.version, dateTime: new Date('2026-09-07T08:00:00Z') });
    assert.equal((await daily('2026-09-01')).expensePiastres, 0n);
    await expenses.remove(driver.id, expense.id, expense.version);
    assert.equal((await daily('2026-08-31')).maintenancePiastres, 1234n, 'Deleted expense restores the service date cost');
    assert.equal((await daily('2026-09-07')).expensePiastres, 0n);
    record = await service.updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: record.version, performedAt: new Date('2026-09-06T21:30:00Z') });
    assert.equal((await daily('2026-08-31')).maintenancePiastres, 0n);
    assert.equal((await daily('2026-09-07')).maintenancePiastres, 1234n, 'Cairo service date crosses UTC day boundary');
    expense = await expenses.restore(driver.id, expense.id, expense.version + 1);
    assert.equal((await daily('2026-09-07')).maintenancePiastres, 0n);
    await service.removeRecord(driver.id, vehicle.id, record.id, record.version);
    assert.equal((await daily('2026-09-07')).netProfitPiastres, -1234n, 'Deleting service preserves its independent expense');
    const archived = await queries.list(driver.id, vehicle.id, ListMaintenanceRecordsSchema.parse({ view: MaintenanceView.Deleted }));
    assert.equal(archived.items[0].id, record.id);
    await assert.rejects(service.restoreRecord(driver.id, vehicle.id, record.id, record.version), ConflictException);
    record = await service.restoreRecord(driver.id, vehicle.id, record.id, record.version + 1);
    record = await service.updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: record.version, linkedExpenseId: null, costPiastres: 0 });
    assert.equal((await daily('2026-09-07')).netProfitPiastres, -1234n, 'A zero-cost service is valid');
    const history = await queries.history(driver.id, vehicle.id, record.id, MaintenanceHistoryQuerySchema.parse({ limit: 2 }));
    assert.equal(history.items[0].version, record.version);
    assert(history.nextCursor);
    const nextHistory = await queries.history(driver.id, vehicle.id, record.id, MaintenanceHistoryQuerySchema.parse({ cursor: history.nextCursor }));
    assert.equal(nextHistory.items[0].version, record.version - 2);
    assert(!JSON.stringify(history).includes('Private service notes'));
    maintenanceHistorySchema.parse(JSON.parse(JSON.stringify(history)));
    const before = await projections(database, driver.id);
    const failing = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database },
      { provide: AggregatesService, useClass: FailMaintenanceProjection }, MaintenanceService] }).compile();
    await assert.rejects(failing.get(MaintenanceService).updateRecord(driver.id, vehicle.id, record.id, { expectedVersion: record.version, costPiastres: 7654 }), /Injected/);
    await failing.close();
    assert.deepEqual(await projections(database, driver.id), before);
    assert.equal((await database.maintenanceRecord.findUniqueOrThrow({ where: { id: record.id } })).version, record.version);
    const competing = await Promise.allSettled([service.addRecord(driver.id, vehicle.id, { ...body, linkedExpenseId: expense.id }), service.addRecord(driver.id, vehicle.id, { ...body, linkedExpenseId: expense.id })]);
    assert.equal(competing.filter((outcome) => outcome.status === 'fulfilled').length, 1);

    const legacyDate = calendarDateValue('2026-07-01');
    await database.maintenanceRecord.create({ data: { ...body, driverId: driver.id, vehicleId: vehicle.id, performedAt: new Date('2026-07-01T09:00Z'), costPiastres: 9000 } });
    await database.dailyAggregate.create({ data: { driverId: driver.id, date: legacyDate, maintAmortPiastres: 7777, netProfitPiastres: -7777 } });
    await database.driver.update({ where: { id: driver.id }, data: { financialProjectionVersion: 1 } });
    assert((await aggregateRepairDates(database, driver.id)).some((date) => date.getTime() === legacyDate.getTime()));
    await assert.rejects(aggregates.assertCalendarsReady(), ServiceUnavailableException);
    const invalid = await database.maintenanceRecord.create({ data: { ...body, driverId: driver.id, vehicleId: vehicle.id,
      performedAt: new Date('2026-09-12T09:00Z'), costPiastres: 3000000 } });
    await database.dailyOdometer.create({ data: { driverId: driver.id, date: calendarDateValue('2026-09-12'), totalKmMeters: 1 } });
    const beforeCutover = await projections(database, driver.id);
    await assert.rejects(aggregates.ensureCalendar(driver.id), BadRequestException);
    assert.deepEqual(await projections(database, driver.id), beforeCutover, 'A later ratio failure rolls earlier cutover dates back');
    assert.equal((await database.driver.findUniqueOrThrow({ where: { id: driver.id } })).financialProjectionVersion, 1);
    await database.maintenanceRecord.delete({ where: { id: invalid.id } });
    await database.dailyOdometer.delete({ where: { driverId_date: { driverId: driver.id, date: calendarDateValue('2026-09-12') } } });
    await Promise.all([aggregates.ensureCalendar(driver.id), aggregates.ensureCalendar(driver.id)]);
    const report = await module.get(AnalyticsService).daily(driver.id, legacyDate);
    assert.equal(report.netProfitPiastres, -9000);
    assert.equal(report.maintenancePiastres, 9000);
    assert.equal(report.retainedMaintenanceEstimatePiastres, 7777, 'Historical estimates remain visible but are not double deducted');
    assert.equal((await database.driver.findUniqueOrThrow({ where: { id: driver.id } })).financialProjectionVersion, FINANCIAL_PROJECTION_VERSION);

    await database.maintenanceRecord.createMany({ data: Array.from({ length: 1003 }, (_, index) => ({ ...body, notes: null, driverId: driver.id, vehicleId: vehicle.id,
      id: `page-${suffix}-${String(index).padStart(4, '0')}`, performedAt: new Date('2026-09-10T09:00Z'), costPiastres: 0 })) });
    const first = await queries.list(driver.id, vehicle.id, ListMaintenanceRecordsSchema.parse({}));
    assert.equal(first.items.length, 25);
    assert(first.nextCursor);
    await service.removeRecord(driver.id, vehicle.id, first.items[24].id, 1);
    const seen = new Set(first.items.map((row) => row.id));
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await queries.list(driver.id, vehicle.id, ListMaintenanceRecordsSchema.parse({ cursor, limit: 100 }));
      for (const row of page.items) { assert(!seen.has(row.id)); seen.add(row.id); }
      cursor = page.nextCursor ?? '';
    }
    assert.equal(seen.size, 1006, 'Tied-date pages survive archival of the cursor row');
    await assert.rejects(queries.list(driver.id, bike.id, ListMaintenanceRecordsSchema.parse({ cursor: first.nextCursor })), BadRequestException);
    await database.maintenanceRecord.createMany({ data: [
      { ...body, driverId: driver.id, vehicleId: vehicle.id, id: `tie-a-${suffix}`, performedAt: new Date('2026-09-11T09:00Z'), costPiastres: 0, odometerMeters: 100000 },
      { ...body, driverId: driver.id, vehicleId: vehicle.id, id: `tie-b-${suffix}`, performedAt: new Date('2026-09-11T09:00Z'), costPiastres: 0, odometerMeters: 200000 },
      { ...body, driverId: driver.id, vehicleId: vehicle.id, id: `future-${suffix}`, performedAt: new Date('2099-01-01T09:00Z'), costPiastres: 0 },
    ] });
    const risk = (await service.risk(driver.id, vehicle.id)).find((row) => row.item.id === item.id);
    assert.equal(risk?.kmSinceLastMeters, 800000, 'Latest service ties use a stable ID and future services do not affect current guidance');
    const reads: number[] = [];
    for (let index = 0; index < 20; index++) { const start = performance.now(); await queries.list(driver.id, vehicle.id, ListMaintenanceRecordsSchema.parse({})); await service.risk(driver.id, vehicle.id); reads.push(performance.now() - start); }
    const p95 = reads.sort((a, b) => a - b)[18];
    assert(p95 < 300, `Maintenance list and risk p95 ${p95.toFixed(2)} ms exceeds local budget`);
    process.stdout.write(`Maintenance list + risk p95 on 1000+ records: ${p95.toFixed(2)} ms\n`);
  } finally {
    await database.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    await database.maintenanceItem.delete({ where: { id: item.id } });
    await module.close();
  }
}
