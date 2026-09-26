import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, VehicleType, FuelType, ExpenseCategory, GoalPeriod } from '@prisma/client';
import { PullSchema, syncPullResponseSchema, type SyncPullResponse } from '@ehsbha/api-contracts';
import { SyncEntityKind } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { pullSync } from '../src/modules/sync/sync-pull';
import { SYNC_ENTITY_ORDER } from '../src/modules/sync/sync.control';

export async function verifySyncReconciliation(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }] }).compile();
  const prisma = module.get(PrismaService), suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `sync-${suffix}`, name: 'Sync source', isSystem: false } });
  const owner = await database.user.create({ data: { phone: `sync-owner-${suffix}`, passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Sync owner' } } }, include: { driver: true } });
  const foreign = await database.user.create({ data: { phone: `sync-foreign-${suffix}`, passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Sync foreign' } } }, include: { driver: true } });
  assert(owner.driver && foreign.driver);
  const driverId = owner.driver.id, foreignId = foreign.driver.id;
  const fixed = new Date('2026-09-16T08:00:00Z'), endedAt = new Date('2026-09-16T08:30:00Z');
  const idFor = (kind: SyncEntityKind, index: number) => `${kind}-${String(index).padStart(4, '0')}-${suffix}`;
  const pull = async (id: string, cursor: string | null = null, limit = 100) => syncPullResponseSchema.parse(
    await pullSync(prisma, id, PullSchema.parse({ ...(cursor ? { cursor } : {}), limit })),
  );
  const collect = async (id: string, initial: SyncPullResponse | null = null) => {
    const pages: SyncPullResponse[] = [];
    let page = initial ?? await pull(id);
    for (let count = 0; count < 100; count += 1) {
      pages.push(page);
      assert.equal(page.cycleId, pages[0].cycleId);
      assert.equal(page.expiresAt, pages[0].expiresAt);
      assert(page.page.items.length <= 100);
      if (!page.nextCursor) return pages;
      page = await pull(id, page.nextCursor);
    }
    throw new Error('Reconciliation did not finish within its expected page count');
  };
  try {
    const empty = await collect(foreignId);
    assert.deepEqual(empty.map((page) => page.page.kind), SYNC_ENTITY_ORDER);
    assert(empty.every((page) => page.page.items.length === 0));
    await database.vehicle.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Vehicles, index), driverId,
      type: VehicleType.CAR, fuelType: FuelType.PETROL_92, odometerMeters: 123456n, createdAt: fixed, updatedAt: fixed })) });
    await database.driverApp.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.DriverApps, index), driverId,
      appSourceId: source.id, customName: `Platform ${index}`, commissionPct: 12.5, createdAt: fixed, updatedAt: fixed })) });
    await database.area.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Areas, index), driverId, name: `Area ${index}`, createdAt: fixed })) });
    const tripData = { driverId, vehicleId: idFor(SyncEntityKind.Vehicles, 0), driverAppId: idFor(SyncEntityKind.DriverApps, 0),
      startedAt: fixed, endedAt, earningsPiastres: 4_294_967_294n, totalKmMeters: 1000, paidKmMeters: 900, emptyKmMeters: 100,
      createdAt: fixed, updatedAt: fixed };
    await database.trip.createMany({ data: Array.from({ length: 205 }, (_, index) => ({ ...tripData, id: idFor(SyncEntityKind.Trips, index) })) });
    await database.fuelLog.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Fuels, index), driverId,
      vehicleId: tripData.vehicleId, dateTime: fixed, quantity: 1.125, totalPiastres: 3000, odometerMeters: 123456n, createdAt: fixed, updatedAt: fixed })) });
    await database.expense.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Expenses, index), driverId,
      category: ExpenseCategory.OTHER, amountPiastres: 50, dateTime: fixed, createdAt: fixed, updatedAt: fixed })) });
    await database.session.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Sessions, index), driverId,
      driverAppId: tripData.driverAppId, startedAt: fixed, endedAt, activeMinutes: 30, createdAt: fixed, updatedAt: fixed })) });
    await database.goal.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Goals, index), driverId,
      period: GoalPeriod.DAILY, targetPiastres: 1000, startsOn: fixed, endsOn: fixed, createdAt: fixed, updatedAt: fixed })) });
    await database.recommendation.createMany({ data: Array.from({ length: 3 }, (_, index) => ({ id: idFor(SyncEntityKind.Recommendations, index), driverId,
      type: 'break', title: 'Recommendation', body: 'Take a break', score: 0.5, payload: { facts: [{ value: 3, missing: null }] },
      generatedAt: fixed, expiresAt: new Date(Date.now() + 86400000) })) });
    const pages = await collect(driverId);
    for (const kind of SYNC_ENTITY_ORDER) {
      const ids = pages.filter((page) => page.page.kind === kind).flatMap((page) => page.page.items.map((item) => item.id));
      assert.equal(ids.length, kind === SyncEntityKind.Trips ? 205 : 3);
      assert.equal(new Set(ids).size, ids.length);
    }
    // Every family must page, including the formerly unbounded lookups/goals.
    let page = await pull(driverId, null, 2);
    const familyPageCounts = new Map<SyncEntityKind, number>();
    do {
      familyPageCounts.set(page.page.kind, (familyPageCounts.get(page.page.kind) ?? 0) + 1);
      if (!page.nextCursor) break;
      page = await pull(driverId, page.nextCursor, 2);
    } while (true);
    for (const kind of SYNC_ENTITY_ORDER) {
      assert.equal(familyPageCounts.get(kind), kind === SyncEntityKind.Trips ? 103 : 2);
    }
    const first = pages[0];
    assert(first.page.kind === SyncEntityKind.Trips);
    assert.equal(first.page.items[0].earningsPiastres, 4_294_967_294);
    assert(first.nextCursor);
    await assert.rejects(pull(foreignId, first.nextCursor), BadRequestException);
    assert((await collect(foreignId)).every((page) => page.page.items.length === 0));
    const replay = await pull(driverId, first.nextCursor);
    assert.deepEqual(await pull(driverId, first.nextCursor), replay);
    assert.doesNotThrow(() => JSON.stringify(pages));
    // The cursor seeks by value even if the previous page's final row disappears.
    const small = await pull(driverId, null, 2);
    assert(small.nextCursor);
    await database.trip.delete({ where: { id: idFor(SyncEntityKind.Trips, 1) } });
    const resumed = await collect(driverId, await pull(driverId, small.nextCursor, 2));
    assert(resumed[0].page.items.some((item) => item.id === idFor(SyncEntityKind.Trips, 2)));
    await database.trip.update({ where: { id: idFor(SyncEntityKind.Trips, 0) }, data: { notes: 'Corrected after delivery', deletedAt: new Date(), version: 2 } });
    await database.area.delete({ where: { id: idFor(SyncEntityKind.Areas, 1) } });
    await database.appSource.update({ where: { id: source.id }, data: { name: 'Updated platform name' } });
    await database.recommendation.update({ where: { id: idFor(SyncEntityKind.Recommendations, 0) }, data: { dismissedAt: new Date() } });
    await database.recommendation.update({ where: { id: idFor(SyncEntityKind.Recommendations, 1) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const refreshed = await collect(driverId);
    const trips = refreshed[0].page;
    assert(trips.kind === SyncEntityKind.Trips);
    assert.equal(trips.items[0].notes, 'Corrected after delivery');
    assert.equal(trips.items[0].version, 2); assert(trips.items[0].deletedAt);
    assert(!refreshed.some((page) => page.page.items.some((item) => item.id === idFor(SyncEntityKind.Areas, 1))));
    const apps = refreshed.find((page) => page.page.kind === SyncEntityKind.DriverApps)?.page;
    assert(apps?.kind === SyncEntityKind.DriverApps); assert.equal(apps.items[0].appSource?.name, 'Updated platform name');
    assert.equal(refreshed.filter((page) => page.page.kind === SyncEntityKind.Recommendations).flatMap((page) => page.page.items.map((item) => item.id)).length, 1);

    // A transaction begun before a pull may commit behind the cursor. The next
    // complete reconciliation must still include it despite old timestamps/IDs.
    let release = () => {}, ready = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    const inserted = new Promise<void>((resolve) => { ready = resolve; });
    const lateId = `000-late-${suffix}`;
    const writing = database.$transaction(async (tx) => {
      await tx.trip.create({ data: { ...tripData, id: lateId } }); ready(); await held;
    }, { timeout: 20000 });
    try {
      await inserted;
      const during = await collect(driverId);
      assert(!during.some((page) => page.page.items.some((item) => item.id === lateId)));
    } finally { release(); await writing; }
    assert((await collect(driverId)).some((page) => page.page.items.some((item) => item.id === lateId)));

    const times: number[] = [];
    for (let count = 0; count < 20; count += 1) { const start = performance.now(); await pull(driverId); times.push(performance.now() - start); }
    times.sort((a, b) => a - b);
    console.info(`Sync reconciliation first-page p95: ${times[18].toFixed(2)}ms; 20 samples, 205 trips, 9 families`);
    assert(times[18] < 300, 'Sync read p95 exceeds the local 300ms budget');
  } finally {
    await database.trip.deleteMany({ where: { driverId } });
    await database.fuelLog.deleteMany({ where: { driverId } });
    await database.expense.deleteMany({ where: { driverId } });
    await database.session.deleteMany({ where: { driverId } });
    await database.user.deleteMany({ where: { id: { in: [owner.id, foreign.id] } } });
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
