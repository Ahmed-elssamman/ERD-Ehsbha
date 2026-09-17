import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PushSchema, syncMutationSchema, syncPushResponseSchema, type SyncMutation } from '@ehsbha/api-contracts';
import { SyncMutationKind, SyncMutationStatus, TripRecordSource } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { SyncService } from '../src/modules/sync/sync.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { FuelService } from '../src/modules/fuel/fuel.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

export async function verifySyncPush(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, SyncService,
    TripsService, FuelService, ExpensesService, SessionsService, AggregatesService] }).compile();
  const sync = module.get(SyncService), sessions = module.get(SessionsService), trips = module.get(TripsService), fuel = module.get(FuelService);
  const suffix = randomUUID();
  const source = await database.appSource.create({ data: { code: `push-${suffix}`, name: 'Push verification', isSystem: false } });
  const createOwner = (label: string) => database.user.create({ data: { phone: `push-${label}-${suffix}`, passwordHash: 'unusable-test-password',
    driver: { create: { displayName: 'Push verification', vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92' } },
      driverApps: { create: { appSourceId: source.id, commissionPct: 0 } } } } }, include: { driver: { include: { vehicles: true, driverApps: true } } } });
  const user = await createOwner('owner'), foreign = await createOwner('foreign');
  assert(user.driver && foreign.driver);
  const driver = user.driver, other = foreign.driver, vehicleId = driver.vehicles[0].id, driverAppId = driver.driverApps[0].id;
  const startedAt = new Date('2026-09-16T08:00:00Z'), endedAt = new Date('2026-09-16T09:00:00Z');
  const trip = syncMutationSchema.parse({ kind: SyncMutationKind.TripCreate, clientMutationId: randomUUID(), payload: {
    vehicleId, driverAppId, startedAt, endedAt, earningsPiastres: 8500, totalKmMeters: 10000, paidKmMeters: 8000, notes: 'Private trip note' } });
  const fuelMutation = syncMutationSchema.parse({ kind: SyncMutationKind.FuelCreate, clientMutationId: randomUUID(), payload: {
    vehicleId, dateTime: startedAt, totalPiastres: 1000, quantity: 1.5, odometerMeters: 12000, notes: 'Private fuel note' } });
  const expense = syncMutationSchema.parse({ kind: SyncMutationKind.ExpenseCreate, clientMutationId: randomUUID(), payload: {
    category: 'OTHER', dateTime: startedAt, amountPiastres: 100, notes: 'Private expense note' } });
  const start = syncMutationSchema.parse({ kind: SyncMutationKind.SessionStart, clientMutationId: randomUUID(), payload: { driverAppId, startedAt } });
  const push = async (mutations: SyncMutation[], ownerId = driver.id) => syncPushResponseSchema.parse(await sync.push(ownerId, PushSchema.parse({ mutations }))).results;
  const state = async () => ({
    trips: await database.trip.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } }),
    fuels: await database.fuelLog.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } }),
    expenses: await database.expense.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } }),
    sessions: await database.session.findMany({ where: { driverId: driver.id }, orderBy: { id: 'asc' } }),
    receipts: await database.driverMutationReceipt.count({ where: { driverId: driver.id } }),
    tripHistory: await database.tripRevision.count({ where: { driverId: driver.id } }),
    fuelHistory: await database.fuelRevision.count({ where: { driverId: driver.id } }),
    sessionHistory: await database.sessionRevision.count({ where: { driverId: driver.id } }),
    expenseHistory: await database.expenseRevision.count({ where: { driverId: driver.id } }),
    vehicle: await database.vehicle.findUniqueOrThrow({ where: { id: vehicleId } }),
    aggregates: await database.dailyAggregate.findMany({ where: { driverId: driver.id }, orderBy: { date: 'asc' } }),
  });
  try {
    const before = Date.now();
    const created = await push([trip, fuelMutation, expense, start]);
    assert(created.every((result) => result.status === SyncMutationStatus.Applied));
    const tripResult = created[0], fuelResult = created[1], expenseResult = created[2], startResult = created[3];
    assert(tripResult.status === SyncMutationStatus.Applied && tripResult.kind === SyncMutationKind.TripCreate && tripResult.data);
    assert(fuelResult.status === SyncMutationStatus.Applied && fuelResult.kind === SyncMutationKind.FuelCreate && fuelResult.data);
    assert(expenseResult.status === SyncMutationStatus.Applied && startResult.status === SyncMutationStatus.Applied);
    assert.equal(tripResult.data.source, TripRecordSource.Sync);
    assert.equal(fuelResult.data.quantity, 1.5); assert.equal(fuelResult.data.odometerMeters, 12000);
    assert(new Date(tripResult.appliedAt).getTime() >= before);
    const saved = await state();
    const repeated = await push([trip, fuelMutation, expense, start]);
    assert(repeated.every((result) => result.status === SyncMutationStatus.Applied && result.replayed));
    assert.deepEqual(await state(), saved, 'Replay must not write records, projections, history or receipts');
    const invalidEnd = syncMutationSchema.parse({ kind: SyncMutationKind.SessionEnd, clientMutationId: randomUUID(), payload: { id: startResult.recordId, expectedVersion: 1, endedAt: startedAt } });
    const semanticPartial = await push([invalidEnd, { ...expense, clientMutationId: randomUUID() }]);
    assert.equal(semanticPartial[0].status, SyncMutationStatus.ValidationError);
    assert.equal(semanticPartial[1].status, SyncMutationStatus.Applied);
    const end = syncMutationSchema.parse({ kind: SyncMutationKind.SessionEnd, clientMutationId: randomUUID(), payload: { id: startResult.recordId, expectedVersion: 1, endedAt } });
    const ended = (await push([end]))[0];
    assert(ended.status === SyncMutationStatus.Applied && ended.kind === SyncMutationKind.SessionEnd && ended.data);
    assert.equal(ended.data.activeMinutes, 60);
    assert.equal((await sessions.end(driver.id, startResult.recordId, { expectedVersion: 1, clientMutationId: end.clientMutationId, endedAt })).id, startResult.recordId);
    await assert.rejects(sessions.end(driver.id, startResult.recordId, { expectedVersion: 1, clientMutationId: end.clientMutationId, endedAt: new Date(endedAt.getTime() + 60000) }), ConflictException);
    const repeatedEnd = (await push([end]))[0];
    assert(repeatedEnd.status === SyncMutationStatus.Applied && repeatedEnd.replayed);

    // Corrections and removals do not invalidate the original acknowledgement.
    await trips.update(driver.id, tripResult.recordId, { expectedVersion: 1, notes: 'Corrected note' });
    await fuel.remove(driver.id, fuelResult.recordId, 1);
    await database.expense.delete({ where: { id: expenseResult.recordId } });
    const afterChanges = await push([trip, fuelMutation, expense, start]);
    const changedTrip = afterChanges[0], deletedFuel = afterChanges[1], removedExpense = afterChanges[2];
    assert(changedTrip.status === SyncMutationStatus.Applied && changedTrip.kind === SyncMutationKind.TripCreate && changedTrip.data);
    assert.equal(changedTrip.data.version, 2); assert.equal(changedTrip.data.notes, 'Corrected note');
    assert(deletedFuel.status === SyncMutationStatus.Applied && deletedFuel.kind === SyncMutationKind.FuelCreate && deletedFuel.data?.deletedAt);
    assert(removedExpense.status === SyncMutationStatus.Applied && removedExpense.data === null);
    assert.equal(await database.expense.count({ where: { id: expenseResult.recordId } }), 0);

    const race = { ...expense, clientMutationId: randomUUID() };
    const raced = await Promise.all([push([race]), push([race])]);
    const applied = raced.flat();
    assert(applied.every((result) => result.status === SyncMutationStatus.Applied));
    assert.equal(new Set(applied.map((result) => result.status === SyncMutationStatus.Applied ? result.recordId : '')).size, 1);
    assert.equal(applied.filter((result) => result.status === SyncMutationStatus.Applied && !result.replayed).length, 1);
    const otherResult = (await push([race], other.id))[0];
    assert(otherResult.status === SyncMutationStatus.Applied);
    assert(applied[0].status === SyncMutationStatus.Applied && applied[0].recordId !== otherResult.recordId);
    const collision = (await push([{ ...start, clientMutationId: race.clientMutationId }]))[0];
    assert(collision.status === SyncMutationStatus.Conflict && collision.error.code === 'IDEMPOTENCY_KEY_REUSED');

    const foreignTrip = syncMutationSchema.parse({ ...trip, clientMutationId: randomUUID(), payload: { ...trip.payload, vehicleId: other.vehicles[0].id } });
    const partial = await push([foreignTrip, { ...expense, clientMutationId: randomUUID() }]);
    assert.equal(partial[0].status, SyncMutationStatus.NotFound); assert.equal(partial[1].status, SyncMutationStatus.Applied);
    assert(!JSON.stringify(partial[0]).includes('Private'));
    const countBeforeInvalid = await database.driverMutationReceipt.count({ where: { driverId: driver.id } });
    await assert.rejects(sync.push(driver.id, { mutations: [expense, expense] }));
    assert.equal(await database.driverMutationReceipt.count({ where: { driverId: driver.id } }), countBeforeInvalid);

    // A failure after domain/history/projection writes must roll back the whole item.
    await database.$executeRawUnsafe(`CREATE FUNCTION verify_sync_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.client_mutation_id LIKE 'rollback-%' THEN RAISE EXCEPTION 'private injected storage failure'; END IF; RETURN NEW; END $$`);
    await database.$executeRawUnsafe('CREATE TRIGGER verify_sync_receipt_failure AFTER INSERT ON driver_mutation_receipts FOR EACH ROW EXECUTE FUNCTION verify_sync_receipt_failure()');
    for (const mutation of [trip, fuelMutation, expense, start]) {
      const prior = await state();
      const result = (await push([{ ...mutation, clientMutationId: `rollback-${randomUUID()}` }]))[0];
      assert.equal(result.status, SyncMutationStatus.InternalError);
      assert(!JSON.stringify(result).includes('private'));
      assert.deepEqual(await state(), prior, `Atomic rollback for ${mutation.kind}`);
    }
    const open = await sessions.start(driver.id, { driverAppId, startedAt, clientMutationId: randomUUID() });
    const priorEnd = await state();
    const failedEnd = syncMutationSchema.parse({ kind: SyncMutationKind.SessionEnd, clientMutationId: `rollback-${randomUUID()}`, payload: { id: open.id, expectedVersion: 1, endedAt } });
    assert.equal((await push([failedEnd]))[0].status, SyncMutationStatus.InternalError);
    assert.deepEqual(await state(), priorEnd);
    await assert.rejects(sessions.end(driver.id, open.id, { expectedVersion: 1, clientMutationId: `rollback-${randomUUID()}`, endedAt }));
    assert.deepEqual(await state(), priorEnd, 'Ordinary session endings also roll back if their receipt fails');
    const ordinaryKey = randomUUID();
    await sessions.end(driver.id, open.id, { expectedVersion: 1, clientMutationId: ordinaryKey, endedAt });
    const replayOrdinary = (await push([syncMutationSchema.parse({ ...failedEnd, clientMutationId: ordinaryKey })]))[0];
    assert(replayOrdinary.status === SyncMutationStatus.Applied && replayOrdinary.replayed);
    await database.$executeRawUnsafe('DROP TRIGGER verify_sync_receipt_failure ON driver_mutation_receipts');
    await database.$executeRawUnsafe('DROP FUNCTION verify_sync_receipt_failure()');

    const receipts = await database.driverMutationReceipt.findMany({ where: { driverId: driver.id } });
    assert(receipts.every((receipt) => Object.keys(receipt).sort().join(',') === 'clientMutationId,createdAt,driverId,recordId,requestHash'));
    assert(!JSON.stringify(receipts).includes('Private'));
    const times: number[] = [];
    for (let count = 0; count < 20; count += 1) {
      const begin = performance.now();
      assert.equal((await push([{ ...expense, clientMutationId: randomUUID() }]))[0].status, SyncMutationStatus.Applied);
      times.push(performance.now() - begin);
    }
    times.sort((a, b) => a - b);
    console.info(`Sync expense write p95: ${times[18].toFixed(2)}ms; 20 committed writes with receipt and projections`);
    assert(times[18] < 500, 'Sync write exceeds the local p95 budget');
  } finally {
    await database.$executeRawUnsafe('DROP TRIGGER IF EXISTS verify_sync_receipt_failure ON driver_mutation_receipts');
    await database.$executeRawUnsafe('DROP FUNCTION IF EXISTS verify_sync_receipt_failure()');
    for (const driverId of [driver.id, other.id]) {
      await database.trip.deleteMany({ where: { driverId } });
      await database.fuelLog.deleteMany({ where: { driverId } });
      await database.expense.deleteMany({ where: { driverId } });
      await database.session.deleteMany({ where: { driverId } });
    }
    await database.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    assert.equal(await database.driverMutationReceipt.count({ where: { driverId: { in: [driver.id, other.id] } } }), 0, 'Account deletion removes receipt metadata');
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
