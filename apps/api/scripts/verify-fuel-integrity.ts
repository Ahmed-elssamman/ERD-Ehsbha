import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { calendarDateValue } from '@ehsbha/shared-types';
import { CreateFuelSchema, CreateExpenseSchema, CreateMaintenanceRecordSchema, ListFuelSchema, FuelHistoryQuerySchema, FuelEfficiencyQuerySchema, fuelHistorySchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { FINANCIAL_PROJECTION_VERSION } from '../src/modules/aggregates/aggregate.control';
import { FuelService } from '../src/modules/fuel/fuel.service';
import { FuelQueriesService } from '../src/modules/fuel/fuel-queries.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { VehiclesService } from '../src/modules/vehicles/vehicles.service';

class FailFuelProjection extends AggregatesService {
  override async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await super.refreshDays(driverId, dates, tx);
    throw new Error('Injected fuel projection failure');
  }
}
export async function verifyFuelIntegrity(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, AggregatesService,
    FuelService, FuelQueriesService, ExpensesService, MaintenanceService, VehiclesService] }).compile();
  const fuel = module.get(FuelService), queries = module.get(FuelQueriesService), expenses = module.get(ExpensesService);
  const vehicles = module.get(VehiclesService), aggregates = module.get(AggregatesService);
  const suffix = randomUUID();
  const makeUser = (prefix: string) => database.user.create({ data: { phone: `${prefix}-${suffix}`, passwordHash: 'unusable-test-password', driver: { create: {
    displayName: 'Fuel integrity', vehicles: { create: [{ type: 'CAR', fuelType: 'PETROL_92', odometerMeters: 100000,
      odometerBaselineMeters: 100000, odometerBaselineAt: new Date('2026-08-01T00:00Z'), odometerBaselineSource: 'MANUAL', odometerSource: 'MANUAL' }] },
  } } }, include: { driver: { include: { vehicles: true } } } });
  const user = await makeUser('fuel-owner'), foreign = await makeUser('fuel-foreign');
  assert(user.driver && foreign.driver);
  const driver = user.driver, other = foreign.driver, vehicle = driver.vehicles[0];
  const item = await database.maintenanceItem.create({ data: { code: `fuel-test-${suffix}`, name: 'Fuel test item', defaultIntervalKm: 10000, defaultIntervalDays: 180 } });
  const day = (date: string) => database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: calendarDateValue(date) } } });
  const mileage = () => database.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
  const body = CreateFuelSchema.parse({ vehicleId: vehicle.id, dateTime: '2026-08-31T20:30Z', totalPiastres: 1234,
    fuelKind: 'PETROL_92', quantity: 20, odometerMeters: 900000, notes: 'Private fuel notes', clientMutationId: suffix });
  try {
    let record = await fuel.create(driver.id, body);
    assert.equal((await fuel.create(driver.id, body)).id, record.id);
    await assert.rejects(fuel.create(driver.id, { ...body, totalPiastres: 1235 }), ConflictException);
    assert.equal((await day('2026-08-31')).fuelPiastres, 1234n);
    assert.equal((await mileage()).odometerMeters, 900000n);
    record = await fuel.update(driver.id, record.id, { odometerMeters: 200000, expectedVersion: record.version });
    assert.equal((await mileage()).odometerMeters, 200000n, 'Correcting a high reading retracts it');
    const expense = await expenses.create(driver.id, CreateExpenseSchema.parse({ vehicleId: vehicle.id, category: 'OTHER', amountPiastres: 1234, dateTime: '2026-08-31T21:10Z' }));
    assert.equal((await day('2026-09-01')).expensePiastres, 1234n, 'Equal amounts are separate until linked');
    record = await fuel.update(driver.id, record.id, { linkedExpenseId: expense.id, expectedVersion: record.version });
    assert.equal((await day('2026-08-31')).fuelPiastres, 0n);
    assert.equal((await day('2026-09-01')).netProfitPiastres, -1234n);
    await assert.rejects(expenses.update(driver.id, expense.id, { amountPiastres: 1235, expectedVersion: expense.version }), ConflictException);
    await assert.rejects(fuel.update(other.id, record.id, { totalPiastres: 1, expectedVersion: record.version }), NotFoundException);
    await assert.rejects(fuel.update(driver.id, record.id, { vehicleId: other.vehicles[0].id, expectedVersion: record.version }), NotFoundException);
    await assert.rejects(fuel.create(driver.id, { ...body, clientMutationId: randomUUID(), linkedExpenseId: expense.id }), ConflictException);
    await assert.rejects(module.get(MaintenanceService).addRecord(driver.id, vehicle.id, CreateMaintenanceRecordSchema.parse({ maintenanceItemId: item.id,
      performedAt: body.dateTime, odometerMeters: 100000, costPiastres: 1234, linkedExpenseId: expense.id })), ConflictException);
    await assert.rejects(database.maintenanceRecord.create({ data: { driverId: driver.id, vehicleId: vehicle.id, maintenanceItemId: item.id,
      performedAt: body.dateTime, odometerMeters: 100000, costPiastres: 1234, linkedExpenseId: expense.id } }), 'Database prevents cross-family links');
    await expenses.remove(driver.id, expense.id, expense.version);
    assert.equal((await day('2026-08-31')).fuelPiastres, 1234n);
    assert.equal((await day('2026-09-01')).expensePiastres, 0n);
    await expenses.restore(driver.id, expense.id, expense.version + 1);
    assert.equal((await day('2026-08-31')).fuelPiastres, 0n);
    await fuel.remove(driver.id, record.id, record.version);
    assert.equal((await mileage()).odometerMeters, 100000n, 'Archive falls back to the explicit baseline');
    record = await fuel.restore(driver.id, record.id, record.version + 1);
    assert.equal((await mileage()).odometerMeters, 200000n);
    const history = await queries.history(driver.id, record.id, FuelHistoryQuerySchema.parse({ limit: 2 }));
    assert.equal(history.items.length, 2); assert(history.nextCursor);
    assert(Math.abs(history.items[0].createdAt.getTime() - Date.now()) < 60_000, 'History instants stay UTC even when the database session uses Cairo');
    const historyRest = await queries.history(driver.id, record.id, FuelHistoryQuerySchema.parse({ cursor: history.nextCursor }));
    assert(history.items[1].version > historyRest.items[0].version);
    assert(!JSON.stringify(history).includes('Private fuel notes'));
    fuelHistorySchema.parse(JSON.parse(JSON.stringify(history)));
    const oldVersion = record.version;
    const competing = await Promise.allSettled([fuel.update(driver.id, record.id, { notes: 'First edit', expectedVersion: oldVersion }), fuel.update(driver.id, record.id, { notes: 'Second edit', expectedVersion: oldVersion })]);
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    record = await database.fuelLog.findUniqueOrThrow({ where: { id: record.id } });
    const beforeMileage = await mileage();
    const beforeHistoryCount = await database.fuelRevision.count({ where: { recordId: record.id } });
    const failing = new FuelService(module.get(PrismaService), new FailFuelProjection(module.get(PrismaService)));
    await assert.rejects(failing.update(driver.id, record.id, { odometerMeters: 999999, dateTime: new Date('2026-09-03T10:00Z'), expectedVersion: record.version }), /Injected fuel/);
    assert.deepEqual(await mileage(), beforeMileage);
    assert.equal((await database.fuelLog.findUniqueOrThrow({ where: { id: record.id } })).version, record.version);
    assert.equal(await database.fuelRevision.count({ where: { recordId: record.id } }), beforeHistoryCount);
    const manual = await vehicles.update(driver.id, vehicle.id, { odometerMeters: 300000, expectedOdometerVersion: beforeMileage.odometerVersion });
    record = await fuel.update(driver.id, record.id, { odometerMeters: 250000, expectedVersion: record.version });
    assert.equal((await mileage()).odometerMeters, 300000n, 'Historical fuel corrections preserve a newer manual reading');
    await assert.rejects(vehicles.update(driver.id, vehicle.id, { odometerMeters: 1, expectedOdometerVersion: beforeMileage.odometerVersion }), ConflictException);
    assert.equal(manual.odometerSource, 'MANUAL');
    await database.driver.update({ where: { id: driver.id }, data: { financialProjectionVersion: 2 } });
    await database.dailyAggregate.updateMany({ where: { driverId: driver.id }, data: { fuelPiastres: 99999 } });
    await aggregates.ensureCalendar(driver.id);
    assert.equal((await database.driver.findUniqueOrThrow({ where: { id: driver.id } })).financialProjectionVersion, FINANCIAL_PROJECTION_VERSION);
    assert.equal((await day('2026-08-31')).fuelPiastres, 0n);
    const free = await fuel.create(driver.id, CreateFuelSchema.parse({ vehicleId: vehicle.id, dateTime: '2026-09-02T10:00Z', totalPiastres: 0 }));
    assert.equal(free.quantity, null); assert.equal(free.odometerMeters, null);
    const dated = new Date('2026-08-10T10:00Z');
    await database.fuelLog.createMany({ data: Array.from({ length: 1003 }, (_, index) => ({ id: `fuel-page-${suffix}-${String(index).padStart(4, '0')}`, driverId: driver.id, vehicleId: vehicle.id, dateTime: dated, totalPiastres: 1 })) });
    const ids = new Set<string>(); let cursor = '';
    do {
      const page = await queries.list(driver.id, ListFuelSchema.parse({ vehicleId: vehicle.id, from: dated, to: dated, limit: 100, ...(cursor ? { cursor } : {}) }));
      assert.equal(page.summary.recordCount, 1003); assert.equal(page.summary.totalPiastres, 1003);
      for (const row of page.items) { assert(!ids.has(row.id)); ids.add(row.id); }
      cursor = page.nextCursor ?? '';
    } while (cursor);
    assert.equal(ids.size, 1003);
    const first = await queries.list(driver.id, ListFuelSchema.parse({ limit: 1 })); assert(first.nextCursor);
    await assert.rejects(queries.list(other.id, ListFuelSchema.parse({ cursor: first.nextCursor })));
    await assert.rejects(queries.efficiency(other.id, FuelEfficiencyQuerySchema.parse({ vehicleId: vehicle.id, from: '2026-08-01', to: '2026-09-02' })), NotFoundException);
    const evidence = await queries.efficiency(driver.id, FuelEfficiencyQuerySchema.parse({ vehicleId: vehicle.id, from: '2026-08-01', to: '2026-09-02' }));
    assert.equal(evidence.kmPerLiter, null);
    const samples: number[] = [];
    for (let count = 0; count < 20; count++) { const start = performance.now(); await queries.list(driver.id, ListFuelSchema.parse({ vehicleId: vehicle.id })); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b);
    assert(samples[18] < 300, `Fuel list p95 ${samples[18].toFixed(2)} ms`);
    process.stdout.write(`Fuel list with 1000+ records: local p95 ${samples[18].toFixed(2)} ms (20 samples)\n`);
  } finally {
    await database.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    await database.maintenanceItem.delete({ where: { id: item.id } });
    await module.close();
  }
}
