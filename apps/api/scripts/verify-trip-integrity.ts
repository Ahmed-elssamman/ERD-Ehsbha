import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateTripSchema, ListTripsSchema, TripHistoryQuerySchema, tripHistorySchema } from '@ehsbha/api-contracts';
import { TripChange, TripChangeActor, TripRecordSource, TripView } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

class FailTripProjection extends AggregatesService {
  override async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await super.refreshDays(driverId, dates, tx);
    throw new Error('Injected trip projection failure');
  }
}
export async function verifyTripIntegrity(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, TripsService, AggregatesService] }).compile();
  const trips = module.get(TripsService);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `trip-integrity-${suffix}`, name: 'Trip integrity', isSystem: false } });
  const createOwner = (prefix: string) => database.user.create({ data: { phone: `${prefix}-${suffix}`, passwordHash: 'unusable-test-password',
    driver: { create: { displayName: 'Trip integrity', vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92' } },
      driverApps: { create: { appSourceId: source.id, commissionPct: 0 } } } } }, include: { driver: { include: { vehicles: true, driverApps: true } } } });
  const user = await createOwner('trip-owner'), foreign = await createOwner('trip-foreign');
  assert(user.driver && foreign.driver);
  const driver = user.driver, other = foreign.driver;
  const input = CreateTripSchema.parse({ vehicleId: driver.vehicles[0].id, driverAppId: driver.driverApps[0].id,
    startedAt: '2026-09-16T08:00:00Z', endedAt: '2026-09-16T08:30:00Z', earningsPiastres: 8500,
    totalKmMeters: 10000, paidKmMeters: 8000, clientMutationId: suffix, notes: 'Private trip notes', pickup: 'Private pickup' });
  try {
    const before = Date.now();
    const record = await trips.create(driver.id, input);
    assert.equal(record.version, 1); assert.equal(record.source, TripRecordSource.Manual);
    assert.equal((await trips.create(driver.id, input)).id, record.id);
    let history = tripHistorySchema.parse(await trips.history(driver.id, record.id, TripHistoryQuerySchema.parse({})));
    assert.equal(history.items.length, 1); assert.equal(history.items[0].action, TripChange.Created);
    assert.equal(history.items[0].actor, TripChangeActor.Driver); assert.equal(history.items[0].before, null);
    assert(new Date(history.items[0].createdAt).getTime() >= before, 'Revision instants use UTC independently of the database session zone');
    assert(!JSON.stringify(history).includes('Private'));
    await assert.rejects(trips.history(other.id, record.id, TripHistoryQuerySchema.parse({})), NotFoundException);
    await assert.rejects(trips.update(other.id, record.id, { expectedVersion: record.version, notes: 'Foreign write' }), NotFoundException);
    const race = await Promise.allSettled([
      trips.update(driver.id, record.id, { expectedVersion: record.version, earningsPiastres: 9000 }),
      trips.update(driver.id, record.id, { expectedVersion: record.version, earningsPiastres: 9500 }),
    ]);
    assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
    const failed = race.find((result) => result.status === 'rejected'); assert(failed?.status === 'rejected');
    assert(failed.reason instanceof ConflictException);
    let current = await trips.get(driver.id, record.id); assert.equal(current.version, 2);
    await assert.rejects(trips.remove(driver.id, record.id, record.version), ConflictException);
    await trips.remove(driver.id, record.id, current.version);
    current = await trips.get(driver.id, record.id); assert(current.deletedAt); assert.equal(current.version, 3);
    assert.equal((await trips.list(driver.id, ListTripsSchema.parse({ view: TripView.Deleted }))).items[0].id, record.id);
    await assert.rejects(trips.restore(driver.id, record.id, 2), ConflictException);
    current = await trips.restore(driver.id, record.id, current.version); assert.equal(current.version, 4); assert.equal(current.deletedAt, null);
    history = tripHistorySchema.parse(await trips.history(driver.id, record.id, TripHistoryQuerySchema.parse({ limit: 2 })));
    assert.deepEqual(history.items.map((entry) => entry.action), [TripChange.Restored, TripChange.Deleted]);
    assert(history.nextCursor);
    const older = await trips.history(driver.id, record.id, TripHistoryQuerySchema.parse({ cursor: history.nextCursor }));
    assert.deepEqual(older.items.map((entry) => entry.version), [2, 1]);
    const sync = await trips.create(driver.id, { ...input, clientMutationId: randomUUID() }, TripRecordSource.Sync);
    assert.equal(sync.source, TripRecordSource.Sync);
    await assert.rejects(trips.history(driver.id, sync.id, TripHistoryQuerySchema.parse({ cursor: history.nextCursor })));
    const partial = await trips.removeBatch(driver.id, [{ id: record.id, expectedVersion: 1 }, { id: sync.id, expectedVersion: sync.version }]);
    assert.deepEqual(partial.deleted, [sync.id]); assert.equal(partial.errors[0].code, 'TRIP_VERSION_CONFLICT');
    const counts = await Promise.all([database.trip.count({ where: { driverId: driver.id } }), database.tripRevision.count({ where: { driverId: driver.id } })]);
    const failing = new TripsService(module.get(PrismaService), new FailTripProjection(module.get(PrismaService)));
    await assert.rejects(failing.create(driver.id, { ...input, clientMutationId: randomUUID() }), /Injected trip projection failure/);
    assert.deepEqual(await Promise.all([database.trip.count({ where: { driverId: driver.id } }), database.tripRevision.count({ where: { driverId: driver.id } })]), counts);

    const tied = new Date('2026-08-01T08:00Z');
    await database.trip.createMany({ data: Array.from({ length: 1003 }, () => ({ driverId: driver.id, vehicleId: driver.vehicles[0].id,
      driverAppId: driver.driverApps[0].id, startedAt: tied, endedAt: new Date('2026-08-01T08:30Z'),
      grossPiastres: 1, commissionPiastres: 0, receivedPiastres: 1, earningsPiastres: 1, totalKmMeters: 1, paidKmMeters: 1, emptyKmMeters: 0 })) });
    const ids = new Set<string>(); let cursor = '';
    do {
      const page = await trips.list(driver.id, ListTripsSchema.parse({ from: tied, to: tied, limit: 100, ...(cursor ? { cursor } : {}) }));
      for (const row of page.items) { assert(!ids.has(row.id)); ids.add(row.id); }
      cursor = page.nextCursor ?? '';
    } while (cursor);
    assert.equal(ids.size, 1003);
    const first = await trips.list(driver.id, ListTripsSchema.parse({ limit: 1 })); assert(first.nextCursor);
    await assert.rejects(trips.list(other.id, ListTripsSchema.parse({ cursor: first.nextCursor })));
    await assert.rejects(trips.list(driver.id, ListTripsSchema.parse({ cursor: first.nextCursor, view: TripView.Deleted })));
    const samples: number[] = [];
    for (let index = 0; index < 20; index++) { const start = performance.now(); await trips.list(driver.id, ListTripsSchema.parse({})); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b); assert(samples[18] < 300);
    process.stdout.write(`Trip integrity: history, origin, version races, rollback and 1003 tied records; local list p95 ${samples[18].toFixed(2)} ms.\n`);
  } finally {
    await database.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    await database.appSource.delete({ where: { id: source.id } }); await module.close();
  }
}
