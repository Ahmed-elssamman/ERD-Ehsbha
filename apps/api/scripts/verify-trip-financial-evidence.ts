import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTripSchema, dailyAnalyticsSchema, weeklyAnalyticsSchema, monthlyAnalyticsSchema, adminAnalyticsOverviewSchema, adminDriverDetailSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AdminAnalyticsService } from '../src/modules/admin/admin-analytics.service';
import { AdminDriversService } from '../src/modules/admin/admin-drivers.service';
import { repairDriverAggregates } from '../src/modules/aggregates/aggregate-repair';

/** Exercises the actual writers and report readers against migrated PostgreSQL. */
export async function verifyTripFinancialEvidence(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [
    { provide: PrismaService, useValue: database }, TripsService, AggregatesService, AnalyticsService, AdminAnalyticsService, AdminDriversService,
  ] }).compile();
  const trips = module.get(TripsService);
  const analytics = module.get(AnalyticsService);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `income-${suffix}`, name: 'Income verification', isSystem: false } });
  const user = await database.user.create({ data: { phone: `income-${suffix}`, passwordHash: 'unusable-test-password-hash',
    driver: { create: { displayName: 'Income verification', vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92' } },
      driverApps: { create: { appSourceId: source.id, commissionPct: 40 } }, areas: { create: { name: 'Income area' } } } },
  }, include: { driver: { include: { vehicles: true, driverApps: true, areas: true } } } });
  assert(user.driver);
  const driver = user.driver;
  const day = new Date('2026-09-16T00:00:00Z');
  const input = CreateTripSchema.parse({ vehicleId: driver.vehicles[0].id, driverAppId: driver.driverApps[0].id, areaId: driver.areas[0].id,
    startedAt: '2026-09-16T08:00:00Z', endedAt: '2026-09-16T08:30:00Z', earningsPiastres: 8500, tipPiastres: 500,
    totalKmMeters: 10000, paidKmMeters: 8000, tollPiastres: 200, parkingPiastres: 300, clientMutationId: randomUUID() });
  try {
    const net = await trips.create(driver.id, input);
    assert.equal(net.grossPiastres, null); assert.equal(net.commissionPiastres, null);
    assert.equal(net.earningsPiastres, 8500n); assert.equal(net.receivedPiastres, 8000);
    assert.equal((await trips.create(driver.id, input)).id, net.id, 'Retry must not duplicate net-only income');
    await assert.rejects(trips.get('another-driver', net.id), NotFoundException);
    const full = await trips.create(driver.id, CreateTripSchema.parse({ ...input, clientMutationId: randomUUID(),
      earningsPiastres: null, grossPiastres: 10000, commissionPiastres: 2000, tipPiastres: 0, tollPiastres: 0, parkingPiastres: 0 }));
    const periods = [dailyAnalyticsSchema.parse(await analytics.daily(driver.id, day)),
      weeklyAnalyticsSchema.parse(await analytics.weekly(driver.id, 2026, 38)), monthlyAnalyticsSchema.parse(await analytics.monthly(driver.id, 2026, 9))];
    for (const period of periods) {
      assert.equal(period.grossPiastres, null); assert.equal(period.knownGrossPiastres, 10000);
      assert.equal(period.grossKnownTripCount, 1); assert.equal(period.commissionKnownTripCount, 1);
      assert.equal(period.tripCount, 2); assert.equal(period.netProfitPiastres, 16000, 'Tips included once and trip costs deducted once');
    }
    for (const item of [...(await analytics.apps(driver.id, 3650)).items, ...(await analytics.areas(driver.id, 3650)).items]) {
      assert.equal(item.grossPiastres, null); assert.equal(item.knownGrossPiastres, 10000); assert.equal(item.netProfitPiastres, 16000);
    }
    const overview = adminAnalyticsOverviewSchema.parse(await module.get(AdminAnalyticsService).overview());
    const app = overview.tripsByApp.find((item) => item.driverAppId === driver.driverApps[0].id); assert(app);
    assert.equal(app.grossPiastres, null); assert.equal(app.grossKnownTripCount, 1);
    const adminDriver = await module.get(AdminDriversService).get(driver.id);
    const adminTotals = adminDriverDetailSchema.shape.totals.parse(adminDriver.totals);
    assert.equal(adminTotals.grossPiastres, null); assert.equal(adminTotals.netProfitPiastres, 16000);

    // Non-money edits preserve evidence; included-tip edits preserve take-home income.
    let edited = await trips.update(driver.id, net.id, { expectedVersion: net.version, notes: 'Reviewed amount' });
    edited = await trips.update(driver.id, net.id, { expectedVersion: edited.version, tipPiastres: 1000 });
    assert.equal(edited.earningsPiastres, 8500n); assert.equal(edited.receivedPiastres, 7500);
    edited = await trips.update(driver.id, net.id, { expectedVersion: edited.version, earningsPiastres: 9000 });
    assert.equal(edited.receivedPiastres, 8000); assert.equal(edited.grossPiastres, null);
    await assert.rejects(trips.update(driver.id, net.id, { expectedVersion: edited.version, tipPiastres: 10000 }), BadRequestException);
    await assert.rejects(trips.update(driver.id, net.id, { expectedVersion: edited.version, grossPiastres: 7000 }), BadRequestException);
    assert.equal((await trips.get(driver.id, net.id)).earningsPiastres, 9000n);
    edited = await trips.update(driver.id, net.id, { expectedVersion: edited.version, grossPiastres: 10000 });
    assert.equal(edited.commissionPiastres, 2000); assert.equal(edited.earningsPiastres, 9000n);
    const enriched = await analytics.daily(driver.id, day);
    assert.equal(enriched.grossPiastres, 20000); assert.equal(enriched.grossKnownTripCount, 2);
    edited = await trips.update(driver.id, net.id, { expectedVersion: edited.version, grossPiastres: null, commissionPiastres: null, receivedPiastres: null, earningsPiastres: 9000 });
    assert.equal((await analytics.daily(driver.id, day)).grossPiastres, null);

    // Reconciliation restores corrupted completeness counters from source facts.
    await database.dailyAggregate.updateMany({ where: { driverId: driver.id }, data: { grossKnownTripCount: 2, commissionKnownTripCount: 2 } });
    await repairDriverAggregates(module.get(PrismaService), module.get(AggregatesService), driver.id);
    assert.equal((await analytics.daily(driver.id, day)).grossKnownTripCount, 1);
    await assert.rejects(database.trip.update({ where: { id: net.id }, data: { earningsPiastres: null } }));
    await assert.rejects(database.trip.update({ where: { id: full.id }, data: { earningsPiastres: 1 } }));
    await trips.remove(driver.id, full.id, full.version);
    const onlyNet = await analytics.daily(driver.id, day);
    assert.equal(onlyNet.grossPiastres, null); assert.equal(onlyNet.knownGrossPiastres, 0); assert.equal(onlyNet.netProfitPiastres, 8500);
    await trips.remove(driver.id, net.id, edited.version);
    assert.equal((await analytics.daily(driver.id, day)).grossPiastres, 0, 'An empty report is a known zero');
    process.stdout.write('Trip financial evidence verified: mixed coverage, edits, replay, isolation, constraints and repair.\n');
  } finally {
    await database.user.delete({ where: { id: user.id } });
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
