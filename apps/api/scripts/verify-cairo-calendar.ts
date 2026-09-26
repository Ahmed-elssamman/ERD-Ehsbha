import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient, ReportingCalendar } from '@prisma/client';
import { businessDateKey, businessDay, calendarDateValue } from '@ehsbha/shared-types';
import { CreateTripSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AdminAnalyticsService } from '../src/modules/admin/admin-analytics.service';
import { FuelService, CreateFuelSchema } from '../src/modules/fuel/fuel.service';
import { ExpensesService, CreateExpenseSchema } from '../src/modules/expenses/expenses.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { OdometerService } from '../src/modules/odometer/odometer.service';
import { aggregateRepairDates, repairDriverAggregates } from '../src/modules/aggregates/aggregate-repair';

function stableRows<T extends { updatedAt: Date }>(rows: T[]) {
  return rows.map(({ updatedAt: _updatedAt, ...row }) => row);
}
async function snapshot(database: PrismaClient, driverId: string) {
  return {
    daily: stableRows(await database.dailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } })),
    weekly: stableRows(await database.weeklyAggregate.findMany({ where: { driverId }, orderBy: [{ isoYear: 'asc' }, { isoWeek: 'asc' }] })),
    monthly: stableRows(await database.monthlyAggregate.findMany({ where: { driverId }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })),
    apps: stableRows(await database.appDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { driverAppId: 'asc' }] })),
    areas: stableRows(await database.areaDailyAggregate.findMany({ where: { driverId }, orderBy: [{ date: 'asc' }, { areaId: 'asc' }] })),
  };
}

/** Real SQL timezone conversion, source writers, all projections and atomic legacy cutover. */
export async function verifyCairoCalendar(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [
    { provide: PrismaService, useValue: database }, TripsService, AggregatesService, AnalyticsService,
    AdminAnalyticsService, FuelService, ExpensesService, SessionsService, OdometerService,
  ] }).compile();
  const trips = module.get(TripsService);
  const aggregates = module.get(AggregatesService);
  const analytics = module.get(AnalyticsService);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `calendar-${suffix}`, name: 'Calendar verification', isSystem: false } });
  const user = await database.user.create({ data: { phone: `calendar-${suffix}`, passwordHash: 'unusable-test-password-hash',
    driver: { create: { displayName: 'Calendar verification', vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92' } },
      driverApps: { create: { appSourceId: source.id, commissionPct: 0 } }, areas: { create: { name: 'Calendar area' } } } },
  }, include: { driver: { include: { vehicles: true, driverApps: true, areas: true } } } });
  assert(user.driver);
  const driver = user.driver;
  const day = (date: string) => calendarDateValue(date);
  const dailyKey = (date: string) => ({ driverId_date: { driverId: driver.id, date: day(date) } });
  const input = CreateTripSchema.parse({ vehicleId: driver.vehicles[0].id, driverAppId: driver.driverApps[0].id, areaId: driver.areas[0].id,
    startedAt: '2026-09-30T20:50:00Z', endedAt: '2026-09-30T21:20:00Z', earningsPiastres: 8000, totalKmMeters: 10000, paidKmMeters: 8000 });
  try {
    assert.equal(driver.reportingCalendar, ReportingCalendar.CAIRO, 'New drivers use Cairo from their first write');
    const runtime = await database.$queryRaw<Array<{ timezone: string; version: string }>>`SELECT current_setting('TimeZone') AS timezone, version() AS version`;
    process.stdout.write(JSON.stringify({ calendarRuntime: { node: process.version, tzdata: process.versions.tz, database: runtime[0] } }) + '\n');
    for (const date of ['2026-01-01', '2026-04-24', '2026-10-29', '2026-10-30']) {
      const range = businessDay(date);
      for (const instant of [range.start, new Date(range.end.getTime() - 1)]) {
        const [row] = await database.$queryRaw<Array<{ date: string }>>`SELECT to_char(${instant}::timestamptz AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS date`;
        assert.equal(row.date, date, 'PostgreSQL and Node must agree on the active Egypt timezone rules');
      }
    }
    await trips.create(driver.id, input);
    await trips.create(driver.id, { ...input, startedAt: new Date('2026-09-30T21:30Z'), endedAt: new Date('2026-09-30T22:00Z') });
    await module.get(FuelService).create(driver.id, CreateFuelSchema.parse({ vehicleId: driver.vehicles[0].id,
      dateTime: '2026-09-30T21:10Z', quantity: 1, pricePerUnitPiastres: 1000, totalPiastres: 1000, odometerMeters: 100000 }));
    await module.get(ExpensesService).create(driver.id, CreateExpenseSchema.parse({ category: 'PHONE', amountPiastres: 200, dateTime: '2026-09-30T21:10Z' }));
    const september = await analytics.daily(driver.id, day('2026-09-30'));
    const october = await analytics.daily(driver.id, day('2026-10-01'));
    assert.equal(september.onlineMinutes, 10); assert.equal(september.tripCount, 1); assert.equal(september.netProfitPiastres, 8000);
    assert.equal(october.onlineMinutes, 50); assert.equal(october.tripCount, 1); assert.equal(october.netProfitPiastres, 6800);
    assert.equal((await analytics.monthly(driver.id, 2026, 10)).netProfitPiastres, 6800);
    assert.equal((await analytics.weekly(driver.id, 2026, 40)).netProfitPiastres, 14800);

    for (const [date, minutes] of [['2026-04-24', 1380], ['2025-10-30', 1500]] as const) {
      const range = businessDay(date);
      const session = await module.get(SessionsService).start(driver.id, { clientMutationId: randomUUID(), driverAppId: driver.driverApps[0].id, startedAt: range.start });
      await module.get(SessionsService).end(driver.id, session.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt: range.end });
      assert.equal((await analytics.daily(driver.id, day(date))).onlineMinutes, minutes, 'DST days use actual elapsed time');
      const app = await database.appDailyAggregate.findFirstOrThrow({ where: { driverId: driver.id, date: day(date) } });
      assert.equal(app.onlineMinutes, minutes);
    }
    const today = businessDateKey(new Date());
    const start = new Date(businessDay(today).start.getTime() + 30 * 60_000);
    const current = await trips.create(driver.id, { ...input, startedAt: start, endedAt: new Date(start.getTime() + 20 * 60_000) });
    const beforeOverview = await module.get(AdminAnalyticsService).overview();
    const currentBucket = beforeOverview.tripsByDay.find((item) => item.day === today);
    assert(currentBucket && currentBucket.trips >= 1, 'Admin SQL groups late UTC trips into the Cairo date');
    const boundCheck = await database.$queryRaw<Array<{ day: string }>>`
      SELECT to_char(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day FROM trips
      WHERE id = ${current.id} AND started_at >= (${businessDay(today).start}::timestamptz AT TIME ZONE 'UTC')`;
    assert.deepEqual(boundCheck, [{ day: today }], 'SQL compares stored UTC timestamps with explicit UTC bounds');
    assert.equal((await analytics.today(driver.id)).tripCount, 1);
    assert.equal((await analytics.apps(driver.id, 1)).items[0].tripCount, 1, 'A one-day window includes Cairo midnight');
    const hours = await analytics.hours(driver.id, 1);
    assert.equal(hours.items.find((item) => item.bucket === 'night')?.tripCount, 1);

    await module.get(OdometerService).set(driver.id, { date: day('2026-10-01'), totalKmMeters: 20000 });
    await database.dailyAggregate.update({ where: dailyKey('2026-10-01'), data: { maintAmortPiastres: 1000 } });
    await aggregates.rebuildDay(driver.id, day('2026-10-01'));
    await database.dailyAggregate.create({ data: { driverId: driver.id, date: day('2026-09-29') } });
    await aggregates.rebuildDay(driver.id, day('2026-09-29'));
    const expected = await snapshot(database, driver.id);
    const sources = await database.trip.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } });
    await database.driver.update({ where: { id: driver.id }, data: { reportingCalendar: ReportingCalendar.UTC } });
    await database.dailyAggregate.updateMany({ where: { driverId: driver.id }, data: { netProfitPiastres: 999999 } });
    await database.weeklyAggregate.updateMany({ where: { driverId: driver.id }, data: { netProfitPiastres: 999999 } });
    await database.monthlyAggregate.updateMany({ where: { driverId: driver.id }, data: { netProfitPiastres: 999999 } });
    const corrupt = await snapshot(database, driver.id);
    const previewDates = await aggregateRepairDates(database, driver.id);
    assert(previewDates.some((date) => date.toISOString().startsWith('2026-10-01')));
    assert.deepEqual(await snapshot(database, driver.id), corrupt, 'Repair preview does not modify projections');
    await assert.rejects(aggregates.assertCalendarsReady(), ServiceUnavailableException);
    await database.dailyOdometer.update({ where: dailyKey('2026-10-01'), data: { totalKmMeters: 1000 } });
    await assert.rejects(aggregates.ensureCalendar(driver.id), BadRequestException);
    assert.deepEqual(await snapshot(database, driver.id), corrupt, 'Failure after rebuilding earlier dates rolls the entire cutover back');
    assert.equal((await database.driver.findUniqueOrThrow({ where: { id: driver.id } })).reportingCalendar, ReportingCalendar.UTC);
    await database.dailyOdometer.update({ where: dailyKey('2026-10-01'), data: { totalKmMeters: 20000 } });
    await Promise.all([aggregates.ensureCalendar(driver.id), aggregates.ensureCalendar(driver.id)]);
    assert.deepEqual(await snapshot(database, driver.id), expected, 'Concurrent cutovers rebuild all five projections exactly once in effect');
    assert.deepEqual(await database.trip.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } }), sources, 'Calendar cutover preserves source instants and financial facts');
    await aggregates.assertCalendarsReady();
    await repairDriverAggregates(database, aggregates, driver.id);
    assert.deepEqual(await snapshot(database, driver.id), expected, 'Repair remains repeatable after the cutover');
    await trips.update(driver.id, current.id, { expectedVersion: current.version, earningsPiastres: 9000 });
    assert.equal((await analytics.today(driver.id)).netProfitPiastres, 9000, 'Normal writes continue after the calendar migration');
  } finally {
    await database.user.delete({ where: { id: user.id } });
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
