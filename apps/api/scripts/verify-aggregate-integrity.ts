import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { NightlyAggregatesJob } from '../src/modules/analytics/nightly-aggregates.job';
import { TripsService } from '../src/modules/trips/trips.service';
import { CreateTripSchema } from '../src/modules/trips/dto/trips.dto';
import { FuelService, CreateFuelSchema } from '../src/modules/fuel/fuel.service';
import { ExpensesService, CreateExpenseSchema } from '../src/modules/expenses/expenses.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { aggregateRepairPeriods, repairDriverAggregates } from '../src/modules/aggregates/aggregate-repair';
import { OdometerService } from '../src/modules/odometer/odometer.service';
import { AdminBulkService } from '../src/modules/admin/admin-bulk.service';
import { AdminAuditService } from '../src/modules/admin/audit.service';
import type { AuthenticatedAdmin } from '../src/modules/admin/admin.types';

class FailAfterProjection extends AggregatesService {
  override async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await super.refreshDays(driverId, dates, tx);
    throw new Error('Injected failure after projection writes');
  }
}

function withoutTimestamp<T extends { updatedAt: Date }>(rows: T[]) {
  return rows.map(({ updatedAt: _updatedAt, ...row }) => row);
}
async function snapshot(database: PrismaClient, driverId: string) {
  return {
    daily: withoutTimestamp(await database.dailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } })),
    weekly: withoutTimestamp(await database.weeklyAggregate.findMany({ where: { driverId }, orderBy: [{ isoYear: 'asc' }, { isoWeek: 'asc' }] })),
    monthly: withoutTimestamp(await database.monthlyAggregate.findMany({ where: { driverId }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })),
    apps: withoutTimestamp(await database.appDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { driverAppId: 'asc' }] })),
    areas: withoutTimestamp(await database.areaDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { areaId: 'asc' }] })),
  };
}

/** Real PostgreSQL and application writers; totals must survive repeated rebuilds. */
export async function verifyAggregateIntegrity(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [
    { provide: PrismaService, useValue: database }, AggregatesService, NightlyAggregatesJob,
    TripsService, FuelService, ExpensesService, SessionsService, OdometerService, AdminBulkService, AdminAuditService,
  ] }).compile();
  const trips = module.get(TripsService);
  const fuel = module.get(FuelService);
  const expenses = module.get(ExpensesService);
  const sessions = module.get(SessionsService);
  const nightly = module.get(NightlyAggregatesJob);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `finance-${suffix}`, name: 'Financial integration', isSystem: false } });
  const user = await database.user.create({ data: {
    phone: `finance-${suffix}`, passwordHash: 'unusable-test-password-hash', driver: { create: {
      displayName: 'Financial integration', vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92' } },
      driverApps: { create: [{ appSourceId: source.id, customName: 'Platform A', commissionPct: 20 }, { appSourceId: source.id, customName: 'Platform B', commissionPct: 20 }] },
      areas: { create: [{ name: 'Area A' }, { name: 'Area B' }] },
    } },
  }, include: { driver: { include: { vehicles: true, driverApps: true, areas: true } } } });
  assert(user.driver);
  const driver = user.driver;
  const firstDay = new Date('2026-09-14T00:00:00.000Z');
  const secondDay = new Date('2026-09-15T00:00:00.000Z');
  const base = CreateTripSchema.parse({
    vehicleId: driver.vehicles[0].id, driverAppId: driver.driverApps[0].id, areaId: driver.areas[0].id,
    startedAt: '2026-09-14T08:00:00.000Z', endedAt: '2026-09-14T08:20:00.000Z',
    grossPiastres: 10000, tipPiastres: 500, commissionPiastres: 2000, totalKmMeters: 10000, paidKmMeters: 8000,
  });
  let otherUserId = '';
  let adminId = '';
  try {
    const other = await database.user.create({ data: { phone: `finance-other-${suffix}`, passwordHash: 'unusable-test-password-hash',
      driver: { create: { displayName: 'Other financial driver' } } }, include: { driver: true } });
    otherUserId = other.id;
    assert(other.driver);
    await database.dailyAggregate.create({ data: { driverId: other.driver.id, date: firstDay, grossPiastres: 12345, tripCount: 7 } });
    const otherBefore = await snapshot(database, other.driver.id);
    const firstTrip = await trips.create(driver.id, base);
    await trips.create(driver.id, { ...base, driverAppId: driver.driverApps[1].id, areaId: driver.areas[1].id,
      startedAt: new Date('2026-09-14T08:30:00.000Z'), endedAt: new Date('2026-09-14T08:50:00.000Z'),
      grossPiastres: 5000, tipPiastres: 0, commissionPiastres: 1000 });
    await trips.create(driver.id, { ...base, startedAt: new Date('2026-09-15T08:00:00.000Z'), endedAt: new Date('2026-09-15T08:20:00.000Z'),
      grossPiastres: 20000, tipPiastres: 1000, commissionPiastres: 5000 });
    const fuelLog = await fuel.create(driver.id, CreateFuelSchema.parse({ vehicleId: driver.vehicles[0].id, dateTime: firstDay,
      quantity: 1, pricePerUnitPiastres: 1000, totalPiastres: 1000, odometerMeters: 100000 }));
    const expense = await expenses.create(driver.id, CreateExpenseSchema.parse({ category: 'PHONE', amountPiastres: 200, dateTime: firstDay }));
    await expenses.create(driver.id, CreateExpenseSchema.parse({ category: 'PHONE', amountPiastres: 300, dateTime: secondDay }));
    const session = await sessions.start(driver.id, { clientMutationId: randomUUID(), driverAppId: driver.driverApps[0].id, startedAt: base.startedAt });
    await sessions.end(driver.id, session.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt: new Date('2026-09-14T09:00:00.000Z') });

    const before = await snapshot(database, driver.id);
    await nightly.recomputeDay(driver.id, firstDay);
    assert.deepEqual(await snapshot(database, driver.id), before, 'Rebuilding one day must not increment other projections');
    await nightly.recomputeDay(driver.id, firstDay);
    assert.deepEqual(await snapshot(database, driver.id), before, 'A repeated rebuild must be idempotent');
    assert.equal(before.daily[0].netProfitPiastres, 11300n);
    assert.equal(before.daily[1].netProfitPiastres, 15700n);
    assert.equal(before.weekly[0].netProfitPiastres, 27000n, 'Weekly net includes all tips and commission');
    assert.equal(before.monthly[0].netProfitPiastres, 27000n, 'Monthly net agrees with its daily totals');
    assert.equal(before.daily[0].onlineMinutes, 60, 'Trip time inside a work session is not added twice');

    // Rebuild repairs existing corrupted projections, without replaying their values.
    await database.dailyAggregate.update({ where: { driverId_date: { driverId: driver.id, date: firstDay } }, data: { grossPiastres: 999999, netProfitPiastres: -99 } });
    await database.weeklyAggregate.updateMany({ where: { driverId: driver.id }, data: { tripCount: 99 } });
    await database.monthlyAggregate.updateMany({ where: { driverId: driver.id }, data: { tripCount: 99 } });
    await database.appDailyAggregate.updateMany({ where: { driverId: driver.id, date: firstDay }, data: { tripCount: 99 } });
    await database.areaDailyAggregate.updateMany({ where: { driverId: driver.id, date: firstDay }, data: { tripCount: 99 } });
    await nightly.recomputeDay(driver.id, firstDay);
    assert.deepEqual(await snapshot(database, driver.id), before);

    // Competing trip corrections reject one stale version while reconciliation stays atomic.
    const correctionRace = await Promise.allSettled([
      fuel.update(driver.id, fuelLog.id, { dateTime: secondDay, expectedVersion: fuelLog.version }),

      expenses.update(driver.id, expense.id, { dateTime: secondDay, expectedVersion: expense.version }),
      trips.update(driver.id, firstTrip.id, { expectedVersion: firstTrip.version, grossPiastres: 12000 }),
      trips.update(driver.id, firstTrip.id, { expectedVersion: firstTrip.version, notes: 'Concurrent note' }),
      nightly.recomputeDay(driver.id, firstDay),
    ]);
    assert.equal(correctionRace.filter((result) => result.status === 'rejected').length, 1);
    const latestTrip = await trips.get(driver.id, firstTrip.id);
    const correctedTrip = await trips.update(driver.id, firstTrip.id, { expectedVersion: latestTrip.version, grossPiastres: 12000, notes: 'Concurrent note' });
    const movedFuel = await database.fuelLog.findUniqueOrThrow({ where: { id: fuelLog.id } });
    await assert.rejects(fuel.update(driver.id, fuelLog.id, { totalPiastres: 1500, expectedVersion: fuelLog.version }), ConflictException);
    await fuel.update(driver.id, fuelLog.id, { totalPiastres: 1500, expectedVersion: movedFuel.version });
    const movedExpense = await database.expense.findUniqueOrThrow({ where: { id: expense.id } });
    await assert.rejects(expenses.update(driver.id, expense.id, { amountPiastres: 400, expectedVersion: expense.version }), ConflictException);
    await expenses.update(driver.id, expense.id, { amountPiastres: 400, expectedVersion: movedExpense.version });
    assert.deepEqual(await database.fuelLog.findUnique({ where: { id: fuelLog.id }, select: { dateTime: true, totalPiastres: true } }), { dateTime: secondDay, totalPiastres: 1500 });
    assert.deepEqual(await database.expense.findUnique({ where: { id: expense.id }, select: { dateTime: true, amountPiastres: true } }), { dateTime: secondDay, amountPiastres: 400 });
    assert.deepEqual(await database.trip.findUnique({ where: { id: firstTrip.id }, select: { grossPiastres: true, notes: true } }), { grossPiastres: 12000, notes: 'Concurrent note' });
    const afterUpdates = await snapshot(database, driver.id);
    await nightly.recomputeDay(driver.id, firstDay);
    await nightly.recomputeDay(driver.id, secondDay);
    assert.deepEqual(await snapshot(database, driver.id), afterUpdates);
    assert.equal(afterUpdates.daily[0].fuelPiastres, 0n);
    assert.equal(afterUpdates.daily[1].fuelPiastres, 1500n);

    const prisma = module.get(PrismaService);
    const failingExpenses = new ExpensesService(prisma, new FailAfterProjection(prisma));
    const expenseCount = await database.expense.count({ where: { driverId: driver.id } });
    await assert.rejects(failingExpenses.create(driver.id, CreateExpenseSchema.parse({ category: 'OTHER', amountPiastres: 999, dateTime: firstDay })), /Injected failure/);
    assert.equal(await database.expense.count({ where: { driverId: driver.id } }), expenseCount);
    assert.deepEqual(await snapshot(database, driver.id), afterUpdates, 'Source and every projection roll back together');

    const competingStarts = await Promise.allSettled([
      sessions.start(driver.id, { clientMutationId: randomUUID(), driverAppId: driver.driverApps[0].id, startedAt: new Date('2026-09-14T10:00Z') }),
      sessions.start(driver.id, { clientMutationId: randomUUID(), driverAppId: driver.driverApps[1].id, startedAt: new Date('2026-09-14T10:00Z') }),
    ]);
    assert.equal(competingStarts.filter((result) => result.status === 'fulfilled').length, 1);
    const open = await sessions.getOpen(driver.id); assert(open);
    await assert.rejects(database.session.create({ data: { driverId: driver.id, driverAppId: open.driverAppId, startedAt: open.startedAt } }));
    await assert.rejects(sessions.end(driver.id, open.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt: new Date('2026-09-14T09:00Z') }), BadRequestException);
    const competingEnds = await Promise.allSettled([
      sessions.end(driver.id, open.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt: new Date('2026-09-14T11:00Z') }),
      sessions.end(driver.id, open.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt: new Date('2026-09-14T11:00Z') }),
    ]);
    assert.equal(competingEnds.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await snapshot(database, driver.id)).daily[0].onlineMinutes, 120);

    // Fare/distance belong to the start date; work time crosses month boundaries.
    const crossMonth = await trips.create(driver.id, { ...base,
      startedAt: new Date('2026-09-30T20:50Z'), endedAt: new Date('2026-09-30T21:20Z'), tollPiastres: 300, parkingPiastres: 200, waitingFeePiastres: 500 });
    const septemberEnd = await database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: new Date('2026-09-30') } } });
    const octoberStart = await database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: new Date('2026-10-01') } } });
    assert.equal(septemberEnd.onlineMinutes, 10);
    assert.equal(septemberEnd.netProfitPiastres, 8000n, 'Toll/parking deducted once; waiting-fee breakdown not added to fare');
    assert.equal(octoberStart.onlineMinutes, 20);
    assert.equal(octoberStart.tripCount, 0);
    assert.equal(octoberStart.grossPiastres, 0n);
    const deletes = await Promise.allSettled([trips.remove(driver.id, crossMonth.id, crossMonth.version), trips.remove(driver.id, crossMonth.id, crossMonth.version)]);
    assert.equal(deletes.filter((result) => result.status === 'fulfilled').length, 1);
    const emptyOctober = await database.monthlyAggregate.findUniqueOrThrow({ where: { driverId_year_month: { driverId: driver.id, year: 2026, month: 10 } } });
    assert.equal(emptyOctober.onlineMinutes, 0);
    assert.equal(emptyOctober.netProfitPiastres, 0n);

    await trips.create(driver.id, { ...base, startedAt: new Date('2027-01-03T08:00Z'), endedAt: new Date('2027-01-03T08:20Z') });
    await trips.create(driver.id, { ...base, startedAt: new Date('2027-01-04T08:00Z'), endedAt: new Date('2027-01-04T08:20Z') });
    const previousYearWeek = await database.weeklyAggregate.findUniqueOrThrow({ where: { driverId_isoYear_isoWeek: { driverId: driver.id, isoYear: 2026, isoWeek: 53 } } });
    const newYearWeek = await database.weeklyAggregate.findUniqueOrThrow({ where: { driverId_isoYear_isoWeek: { driverId: driver.id, isoYear: 2027, isoWeek: 1 } } });
    assert.equal(previousYearWeek.netProfitPiastres, 8500n);
    assert.equal(newYearWeek.netProfitPiastres, 8500n);
    const january = await database.monthlyAggregate.findUniqueOrThrow({ where: { driverId_year_month: { driverId: driver.id, year: 2027, month: 1 } } });
    assert.equal(january.netProfitPiastres, 17000n);

    const odometer = module.get(OdometerService);
    await odometer.set(driver.id, { date: firstDay, totalKmMeters: 40000 });
    await assert.rejects(odometer.set(driver.id, { date: firstDay, totalKmMeters: 100 }), BadRequestException);
    const withOdometer = await snapshot(database, driver.id);
    assert.equal(withOdometer.daily[0].totalKmMeters, 40000n);
    assert.equal(withOdometer.daily[0].emptyKmMeters, 24000n);
    assert.equal(withOdometer.weekly[0].totalKmMeters, 50000n);
    await nightly.recomputeDay(driver.id, firstDay);
    assert.deepEqual(await snapshot(database, driver.id), withOdometer, 'Rebuild preserves the recorded daily distance');
    await assert.rejects(trips.update(driver.id, firstTrip.id, { expectedVersion: correctedTrip.version, totalKmMeters: 50000, paidKmMeters: 50000 }), BadRequestException);
    assert.deepEqual(await snapshot(database, driver.id), withOdometer, 'An inconsistent odometer/paid-distance edit rolls back');

    const admin = await database.adminUser.create({ data: { email: `finance-${suffix}@example.test`, displayName: 'Finance test', passwordHash: 'unusable-test-password-hash' } });
    adminId = admin.id;
    const actor: AuthenticatedAdmin = { id: admin.id, email: admin.email, displayName: admin.displayName,
      roles: [], permissions: [], permissionsVersion: 1, mfaPassed: true };
    const bulk = module.get(AdminBulkService);
    await assert.rejects(bulk.softDeleteTrips({ ...actor, id: `missing-${suffix}` }, [{ id: firstTrip.id, expectedVersion: correctedTrip.version }], 'Audit rollback test'));
    assert.deepEqual(await snapshot(database, driver.id), withOdometer, 'Audit failure rolls back source and projections');
    assert.equal((await database.trip.findUniqueOrThrow({ where: { id: firstTrip.id } })).deletedAt, null);
    const deletionResults = await Promise.allSettled([bulk.softDeleteTrips(actor, [{ id: firstTrip.id, expectedVersion: correctedTrip.version }], 'Integration test'), bulk.softDeleteTrips(actor, [{ id: firstTrip.id, expectedVersion: correctedTrip.version }], 'Integration test')]);
    assert.equal(deletionResults.filter((result) => result.status === 'fulfilled').length, 1);
    const afterAdminDelete = await snapshot(database, driver.id);
    assert.equal(afterAdminDelete.daily[0].tripCount, withOdometer.daily[0].tripCount - 1);
    assert.equal(afterAdminDelete.daily[0].totalKmMeters, 40000n);
    const archivedTrip = await trips.get(driver.id, firstTrip.id); assert(archivedTrip.deletedAt);
    await assert.rejects(trips.update(driver.id, firstTrip.id, { expectedVersion: archivedTrip.version, grossPiastres: 12300 }), ConflictException);
    assert.equal(await database.adminAuditLog.count({ where: { actorAdminId: admin.id } }), 1);
    const failingBulk = new AdminBulkService(prisma, module.get(AdminAuditService), new FailAfterProjection(prisma));
    await assert.rejects(failingBulk.restoreTrips(actor, [{ id: firstTrip.id, expectedVersion: archivedTrip.version }], 'Rollback test'), /Injected failure/);
    assert.deepEqual(await snapshot(database, driver.id), afterAdminDelete);
    assert((await database.trip.findUniqueOrThrow({ where: { id: firstTrip.id } })).deletedAt);
    assert.equal(await database.adminAuditLog.count({ where: { actorAdminId: admin.id } }), 1);
    await bulk.restoreTrips(actor, [{ id: firstTrip.id, expectedVersion: archivedTrip.version }], 'Integration test');
    assert.deepEqual(await snapshot(database, driver.id), withOdometer, 'Admin restore repairs every projection');
    assert.equal(await database.adminAuditLog.count({ where: { actorAdminId: admin.id } }), 2);
    const adminRevisions = await database.tripRevision.findMany({ where: { recordId: firstTrip.id, actor: 'ADMIN' }, orderBy: { version: 'asc' } });
    assert.deepEqual(adminRevisions.map((revision) => [revision.action, revision.version]), [['DELETED', correctedTrip.version + 1], ['RESTORED', correctedTrip.version + 2]]);
    const final = await snapshot(database, driver.id);
    for (const day of final.daily) await nightly.recomputeDay(driver.id, day.date);
    assert.deepEqual(await snapshot(database, driver.id), final);
    const staleDate = new Date('2025-01-01T00:00Z');
    await database.monthlyAggregate.create({ data: { driverId: driver.id, year: 2025, month: 1, tripCount: 999, grossPiastres: 999999 } });
    assert((await aggregateRepairPeriods(database, driver.id)).some((period) => period.date.getTime() === staleDate.getTime()));
    await repairDriverAggregates(database, module.get(AggregatesService), driver.id);
    const repaired = await snapshot(database, driver.id);
    assert.equal(repaired.monthly.find((month) => month.year === 2025)?.tripCount, 0);
    await repairDriverAggregates(database, module.get(AggregatesService), driver.id);
    assert.deepEqual(await snapshot(database, driver.id), repaired, 'The complete repair is idempotent, including stale periods');
    assert.deepEqual(await snapshot(database, other.driver.id), otherBefore, 'Reconciliation cannot change another driver');

    // A deliberately dense synthetic day measures projection cost independently of OCR/provider latency.
    const loadDate = new Date('2026-11-01T08:00Z');
    await database.trip.createMany({ data: Array.from({ length: 1000 }, () => ({
      ...base, driverId: driver.id, emptyKmMeters: base.totalKmMeters - base.paidKmMeters,
      startedAt: loadDate, endedAt: new Date('2026-11-01T08:20Z'),
    })) });
    const rebuildTimes: number[] = [];
    const writeTimes: number[] = [];
    for (let sample = 0; sample < 10; sample += 1) {
      const rebuildStarted = performance.now();
      await nightly.recomputeDay(driver.id, loadDate);
      rebuildTimes.push(performance.now() - rebuildStarted);
      const writeStarted = performance.now();
      await expenses.create(driver.id, CreateExpenseSchema.parse({ category: 'OTHER', dateTime: loadDate, amountPiastres: 1 }));
      writeTimes.push(performance.now() - writeStarted);
    }
    const loadDay = await database.dailyAggregate.findUniqueOrThrow({ where: { driverId_date: { driverId: driver.id, date: new Date('2026-11-01') } } });
    assert.equal(loadDay.tripCount, 1000);
    assert.equal(loadDay.netProfitPiastres, 8499990n);
    process.stdout.write(JSON.stringify({ financialProjectionMeasurement: { trips: 1000, samples: 10,
      rebuildP95Ms: Math.ceil(rebuildTimes.sort((a, b) => a - b)[9]), writeP95Ms: Math.ceil(writeTimes.sort((a, b) => a - b)[9]) } }) + '\n');
  } finally {
    await database.trip.deleteMany({ where: { driverId: driver.id } });
    await database.fuelLog.deleteMany({ where: { driverId: driver.id } });
    await database.expense.deleteMany({ where: { driverId: driver.id } });
    await database.session.deleteMany({ where: { driverId: driver.id } });
    await database.user.delete({ where: { id: user.id } });
    if (otherUserId) await database.user.delete({ where: { id: otherUserId } });
    if (adminId) {
      await database.adminAuditLog.deleteMany({ where: { actorAdminId: adminId } });
      await database.adminUser.delete({ where: { id: adminId } });
    }
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
