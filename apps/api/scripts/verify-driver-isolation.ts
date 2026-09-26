import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { CreateTripSchema } from '../src/modules/trips/dto/trips.dto';
import { CreateFuelSchema, FuelService } from '../src/modules/fuel/fuel.service';
import { CreateExpenseSchema, ExpensesService } from '../src/modules/expenses/expenses.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { SyncService, PushSchema } from '../src/modules/sync/sync.service';

/** Real services, real PostgreSQL constraints and aggregates; no mocked writes. */
export async function verifyDriverIsolation(database: PrismaClient): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: PrismaService, useValue: database },
      AggregatesService, TripsService, FuelService, ExpensesService, SessionsService, SyncService,
    ],
  }).compile();
  const trips = moduleRef.get(TripsService);
  const fuel = moduleRef.get(FuelService);
  const expenses = moduleRef.get(ExpensesService);
  const sessions = moduleRef.get(SessionsService);
  const sync = moduleRef.get(SyncService);
  const suffix = randomUUID();
  const source = await database.appSource.create({
    data: { code: `isolation-${suffix}`, name: 'Isolation test platform', isSystem: false },
  });
  const createDriver = async (label: string) => {
    const user = await database.user.create({
      data: {
        phone: `isolation-${label}-${suffix}`,
        passwordHash: 'unusable-test-password-hash',
        driver: {
          create: {
            displayName: `Isolation ${label}`,
            vehicles: { create: { type: 'CAR', fuelType: 'PETROL_92', odometerMeters: 10000 } },
            driverApps: { create: { appSourceId: source.id, commissionPct: 20 } },
            areas: { create: { name: 'Test area' } },
          },
        },
      },
      include: { driver: { include: { vehicles: true, driverApps: true, areas: true } } },
    });
    assert(user.driver);
    return { user, driver: user.driver };
  };
  const a = await createDriver('a');
  const b = await createDriver('b');
  const driverIds = [a.driver.id, b.driver.id];
  const startedAt = new Date('2026-09-15T08:00:00.000Z');
  const endedAt = new Date('2026-09-15T08:30:00.000Z');
  const key = `shared-${suffix}`;
  const tripInput = CreateTripSchema.parse({
    vehicleId: a.driver.vehicles[0].id,
    driverAppId: a.driver.driverApps[0].id,
    areaId: a.driver.areas[0].id,
    startedAt, endedAt,
    grossPiastres: 10000, receivedPiastres: 8000,
    totalKmMeters: 12000, paidKmMeters: 10000,
    clientMutationId: key,
  });
  const fuelInput = CreateFuelSchema.parse({
    vehicleId: a.driver.vehicles[0].id, dateTime: startedAt,
    quantity: 5, pricePerUnitPiastres: 2000, totalPiastres: 10000,
    odometerMeters: 11000, clientMutationId: key,
  });
  const expenseInput = CreateExpenseSchema.parse({
    vehicleId: a.driver.vehicles[0].id, category: 'PARKING',
    amountPiastres: 1000, dateTime: startedAt, clientMutationId: key,
  });

  try {
    const tripA = await trips.create(a.driver.id, tripInput);
    const tripB = await trips.create(b.driver.id, {
      ...tripInput,
      vehicleId: b.driver.vehicles[0].id,
      driverAppId: b.driver.driverApps[0].id,
      areaId: b.driver.areas[0].id,
    });
    assert.notEqual(tripA.id, tripB.id);
    assert.equal(tripB.driverId, b.driver.id);
    assert.equal((await trips.create(a.driver.id, tripInput)).id, tripA.id);
    await assert.rejects(trips.create(a.driver.id, { ...tripInput, grossPiastres: 12000 }), ConflictException);

    const fuelA = await fuel.create(a.driver.id, fuelInput);
    const fuelB = await fuel.create(b.driver.id, { ...fuelInput, vehicleId: b.driver.vehicles[0].id });
    assert.notEqual(fuelA.id, fuelB.id);
    assert.equal((await fuel.create(a.driver.id, fuelInput)).id, fuelA.id);
    await assert.rejects(fuel.create(a.driver.id, { ...fuelInput, totalPiastres: 11000 }), ConflictException);

    const expenseA = await expenses.create(a.driver.id, expenseInput);
    const expenseB = await expenses.create(b.driver.id, { ...expenseInput, vehicleId: b.driver.vehicles[0].id });
    assert.notEqual(expenseA.id, expenseB.id);
    assert.equal((await expenses.create(a.driver.id, expenseInput)).id, expenseA.id);
    await assert.rejects(expenses.create(a.driver.id, { ...expenseInput, amountPiastres: 2000 }), ConflictException);

    const sessionInput = { driverAppId: a.driver.driverApps[0].id, startedAt, clientMutationId: key };
    const sessionA = await sessions.start(a.driver.id, sessionInput);
    const sessionB = await sessions.start(b.driver.id, { ...sessionInput, driverAppId: b.driver.driverApps[0].id });
    assert.notEqual(sessionA.id, sessionB.id);
    assert.equal((await sessions.start(a.driver.id, sessionInput)).id, sessionA.id);
    await assert.rejects(sessions.start(a.driver.id, { ...sessionInput, startedAt: endedAt }), ConflictException);

    // Retry keys must never bypass authorization of the submitted references.
    await assert.rejects(trips.create(b.driver.id, tripInput), NotFoundException);
    await assert.rejects(fuel.create(b.driver.id, fuelInput), NotFoundException);
    await assert.rejects(expenses.create(b.driver.id, expenseInput), NotFoundException);
    await assert.rejects(sessions.start(b.driver.id, sessionInput), NotFoundException);
    await assert.rejects(trips.create(a.driver.id, {
      ...tripInput, clientMutationId: `other-${suffix}`, driverAppId: b.driver.driverApps[0].id,
    }), NotFoundException);
    await assert.rejects(trips.create(a.driver.id, {
      ...tripInput, clientMutationId: `other-${suffix}`, areaId: b.driver.areas[0].id,
    }), NotFoundException);

    await assert.rejects(trips.update(a.driver.id, tripA.id, { expectedVersion: tripA.version, vehicleId: b.driver.vehicles[0].id }), NotFoundException);
    await assert.rejects(trips.update(a.driver.id, tripA.id, { expectedVersion: tripA.version, driverAppId: b.driver.driverApps[0].id }), NotFoundException);
    await assert.rejects(trips.update(a.driver.id, tripA.id, { expectedVersion: tripA.version, areaId: b.driver.areas[0].id }), NotFoundException);
    await assert.rejects(fuel.update(a.driver.id, fuelA.id, { expectedVersion: fuelA.version, vehicleId: b.driver.vehicles[0].id }), NotFoundException);
    await assert.rejects(expenses.update(a.driver.id, expenseA.id, { vehicleId: b.driver.vehicles[0].id, expectedVersion: expenseA.version }), NotFoundException);
    await assert.rejects(trips.get(b.driver.id, tripA.id), NotFoundException);
    await assert.rejects(trips.remove(b.driver.id, tripA.id, tripA.version), NotFoundException);
    await assert.rejects(sessions.end(b.driver.id, sessionA.id, { expectedVersion: 1, clientMutationId: randomUUID(), endedAt }), NotFoundException);

    const batch = await trips.createBatch(b.driver.id, [tripInput]);
    assert.equal(batch.created.length, 0);
    assert.equal(batch.errors.length, 1);
    const { clientMutationId: _tripMutation, ...syncTripInput } = tripInput;
    const synced = await sync.push(b.driver.id, PushSchema.parse({
      mutations: [{
        clientMutationId: `sync-${suffix}`,
        kind: 'trip.create',
        payload: { ...syncTripInput, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() },
      }],
    }));
    assert.notEqual(synced.results[0].status, 'APPLIED');

    // Same-driver keys are unique in PostgreSQL itself, across concurrent clients.
    const conflictKey = `race-${suffix}`;
    const competingWrites = await Promise.allSettled([
      database.trip.create({ data: { ...tripInput, commissionPiastres: 2000, driverId: a.driver.id, emptyKmMeters: 2000, clientMutationId: conflictKey } }),
      database.trip.create({ data: { ...tripInput, commissionPiastres: 2000, driverId: a.driver.id, emptyKmMeters: 2000, clientMutationId: conflictKey } }),
    ]);
    assert.equal(competingWrites.filter((result) => result.status === 'fulfilled').length, 1);

    const aggregate = await database.dailyAggregate.findFirstOrThrow({ where: { driverId: a.driver.id } });
    assert.equal(aggregate.tripCount, 1);
    assert.equal(aggregate.grossPiastres, 10000n);
    assert.equal(aggregate.commissionPiastres, 2000n);
    assert.equal(aggregate.expensePiastres, 1000n);
    assert.equal(aggregate.fuelPiastres, 10000n);
    const vehicleB = await database.vehicle.findUniqueOrThrow({ where: { id: b.driver.vehicles[0].id } });
    assert.equal(vehicleB.odometerMeters, 11000n);
  } finally {
    // This harness only runs against a safety-checked disposable database.
    await database.trip.deleteMany({ where: { driverId: { in: driverIds } } });
    await database.fuelLog.deleteMany({ where: { driverId: { in: driverIds } } });
    await database.expense.deleteMany({ where: { driverId: { in: driverIds } } });
    await database.session.deleteMany({ where: { driverId: { in: driverIds } } });
    await database.user.deleteMany({ where: { id: { in: [a.user.id, b.user.id] } } });
    await database.appSource.delete({ where: { id: source.id } });
    await moduleRef.close();
  }
}
