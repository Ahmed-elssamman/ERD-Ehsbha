import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, type Trip } from '@prisma/client';
import { ocrConfirmationRequestSchema, type OcrImportDetail, type OcrConfirmationItem } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import type { CreateTripDto } from '../src/modules/trips/dto/trips.dto';
import { OcrConfirmationService } from '../src/modules/ocr/imports/ocr-confirmation.service';
import { OcrImportStore } from '../src/modules/ocr/imports/ocr-import-store.service';

interface ConfirmationTestContext {
  database: PrismaClient; prisma: PrismaService; trips: TripsService; aggregates: AggregatesService;
  confirmations: OcrConfirmationService; store: OcrImportStore; batch: OcrImportDetail; owner: string; stranger: string;
}
class FailAfterTripWriter extends TripsService {
  override async createInTransaction(tx: Prisma.TransactionClient, driverId: string, dto: CreateTripDto): Promise<Trip> {
    await super.createInTransaction(tx, driverId, dto);
    throw new Error('Private database failure fixture');
  }
}

/** Real financial writes/rollback and acknowledgement constraints; fixture OCR evidence. */
export async function verifyOcrConfirmations(context: ConfirmationTestContext): Promise<void> {
  const { database, prisma, trips, aggregates, confirmations, store, batch, owner, stranger } = context;
  const source = await database.appSource.create({ data: { code: `confirmation-${randomUUID()}`, name: 'Uber', isSystem: false } });
  const vehicle = await database.vehicle.create({ data: { driverId: owner, type: 'CAR', fuelType: 'PETROL_92' } });
  const foreignVehicle = await database.vehicle.create({ data: { driverId: stranger, type: 'BIKE', fuelType: 'PETROL_92' } });
  const app = await database.driverApp.create({ data: { driverId: owner, appSourceId: source.id, commissionPct: 20 } });
  const candidateIds = batch.result?.trips.flatMap((candidate) => candidate.evidence ? [candidate.evidence.id] : []) ?? [];
  assert.equal(candidateIds.length, 2);
  const makeItem = (candidateId: string): OcrConfirmationItem => ocrConfirmationRequestSchema.parse({ items: [{ candidateId, trip: {
    vehicleId: vehicle.id, driverAppId: app.id, startedAt: '2026-09-16T10:00:00.000Z', endedAt: '2026-09-16T10:30:00.000Z',
    grossPiastres: 10000, receivedPiastres: 8000, commissionPiastres: 2000, tipPiastres: 200,
    tollPiastres: 300, parkingPiastres: 400, totalKmMeters: 12000, paidKmMeters: 10000,
    pickup: 'Pickup fixture', destination: 'Destination fixture', paymentMethod: 'wallet', waitingFeePiastres: 500, notes: 'Confirmation fixture',
  } }] }).items[0];
  const first = makeItem(candidateIds[0]);
  const second = makeItem(candidateIds[1]);
  second.trip = { ...second.trip, grossPiastres: null, commissionPiastres: null, receivedPiastres: null, earningsPiastres: 8200 };
  try {
    await assert.rejects(confirmations.confirm(stranger, batch.id, { items: [first] }), NotFoundException);
    await assert.rejects(confirmations.confirm(owner, batch.id, { items: [{ ...first, trip: { ...first.trip, commissionPiastres: 1000 } }] }), BadRequestException);
    const competing = await Promise.all([confirmations.confirm(owner, batch.id, { items: [first] }), confirmations.confirm(owner, batch.id, { items: [first] })]);
    const receipt = competing[0].saved[0]; assert(receipt);
    assert.deepEqual(competing[1].saved[0], receipt);
    assert.equal(await database.trip.count({ where: { driverId: owner } }), 1);
    assert.equal(await database.ocrTripConfirmation.count({ where: { driverId: owner } }), 1);
    const trip = await database.trip.findUniqueOrThrow({ where: { id: receipt.tripId } });
    assert.equal(trip.paymentMethod, 'wallet'); assert.equal(trip.pickup, 'Pickup fixture'); assert.equal(trip.waitingFeePiastres, 500);
    const history = await database.ocrTripConfirmation.findFirstOrThrow({ where: { driverId: owner } });
    assert(!Object.prototype.hasOwnProperty.call(history.confirmed, 'earningsPiastres'), 'Legacy confirmation snapshot layout remains replayable');
    assert(!history.correctedFields.includes('earningsPiastres'), 'An absent amount is not a correction');
    assert(history.correctedFields.includes('grossPiastres'));
    assert(!JSON.stringify(history.original).includes('rawText'));
    assert.equal((await store.get(owner, batch.id)).confirmations.length, 1);

    const changed = await confirmations.confirm(owner, batch.id, { items: [{ ...first, trip: { ...first.trip, grossPiastres: 11000, receivedPiastres: 9000 } }] });
    assert.equal(changed.failed[0].code, 'IDEMPOTENCY_KEY_REUSED');
    const partial = await confirmations.confirm(owner, batch.id, { items: [first, { ...second, trip: { ...second.trip, vehicleId: foreignVehicle.id } }] });
    assert.equal(partial.saved.length, 1); assert.equal(partial.failed[0].code, 'NOT_FOUND');
    const missing = await confirmations.confirm(owner, batch.id, { items: [makeItem('f'.repeat(64))] });
    assert.equal(missing.failed[0].code, 'OCR_CANDIDATE_NOT_FOUND');
    await database.vehicle.update({ where: { id: vehicle.id }, data: { isActive: false } });
    assert.equal((await confirmations.confirm(owner, batch.id, { items: [second] })).failed[0].code, 'OCR_REFERENCE_INACTIVE');
    await database.vehicle.update({ where: { id: vehicle.id }, data: { isActive: true } });

    // Fail after the real trip and all aggregate writes, before the receipt write.
    const failing = new OcrConfirmationService(prisma, new FailAfterTripWriter(prisma, aggregates));
    const rollback = await failing.confirm(owner, batch.id, { items: [second] });
    assert.equal(rollback.failed[0].code, 'OCR_CONFIRMATION_RETRY');
    assert(!JSON.stringify(rollback).includes('Private'));
    assert.equal(await database.trip.count({ where: { driverId: owner } }), 1);
    assert.equal(await database.ocrTripConfirmation.count({ where: { driverId: owner } }), 1);
    const oneTrip = await database.dailyAggregate.findFirstOrThrow({ where: { driverId: owner } });
    assert.equal(oneTrip.tripCount, 1); assert.equal(oneTrip.grossPiastres, 10000n);
    const retried = await confirmations.confirm(owner, batch.id, { items: [second] });
    assert.equal(retried.saved.length, 1);
    const mixed = await database.dailyAggregate.findFirstOrThrow({ where: { driverId: owner } });
    assert.equal(mixed.grossPiastres, 10000n); assert.equal(mixed.grossKnownTripCount, 1); assert.equal(mixed.netProfitPiastres, 15000n);
    const netOnly = await database.trip.findUniqueOrThrow({ where: { id: retried.saved[0].tripId } });
    assert.equal(netOnly.grossPiastres, null); assert.equal(netOnly.commissionPiastres, null); assert.equal(netOnly.earningsPiastres, 8200n);
    assert.equal((await confirmations.confirm(owner, batch.id, { items: [second] })).saved[0].tripId, netOnly.id);

    // A correction must use the version reviewed by the caller.
    const original = await trips.get(owner, receipt.tripId);
    const raced = await Promise.allSettled([
      trips.update(owner, receipt.tripId, { expectedVersion: original.version, totalKmMeters: 15000 }),
      trips.update(owner, receipt.tripId, { expectedVersion: original.version, notes: 'Edited after import' }),
    ]);
    assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1);
    const winner = await trips.get(owner, receipt.tripId);
    const updated = await trips.update(owner, receipt.tripId, { expectedVersion: winner.version, totalKmMeters: 15000, notes: 'Edited after import' });
    assert.equal(updated.totalKmMeters, 15000); assert.equal(updated.notes, 'Edited after import');
    await assert.rejects(trips.update(owner, receipt.tripId, { expectedVersion: updated.version, totalKmMeters: 1 }), BadRequestException);
    await assert.rejects(trips.update(owner, receipt.tripId, { expectedVersion: updated.version, endedAt: new Date('2026-09-16T09:00:00Z') }), BadRequestException);
    await trips.update(owner, receipt.tripId, { expectedVersion: updated.version, grossPiastres: 12000, receivedPiastres: 10000, tollPiastres: 700, pickup: 'Updated pickup' });
    assert.equal((await confirmations.confirm(owner, batch.id, { items: [first] })).saved[0].tripId, receipt.tripId);
    const edited = await trips.get(owner, receipt.tripId);
    assert.equal(edited.grossPiastres, 12000); assert.equal(edited.tollPiastres, 700); assert.equal(edited.pickup, 'Updated pickup');
    assert.equal((await database.dailyAggregate.findFirstOrThrow({ where: { driverId: owner } })).grossPiastres, 12000n);

    const deletes = await Promise.allSettled([trips.remove(owner, receipt.tripId, edited.version), trips.remove(owner, receipt.tripId, edited.version)]);
    assert.equal(deletes.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await database.dailyAggregate.findFirstOrThrow({ where: { driverId: owner } })).tripCount, 1);
    const deletedReplay = await confirmations.confirm(owner, batch.id, { items: [first] });
    assert.equal(deletedReplay.saved[0].deleted, true);
    assert.equal(await database.trip.count({ where: { driverId: owner, deletedAt: null } }), 1);
    assert((await database.trip.findUniqueOrThrow({ where: { id: receipt.tripId } })).deletedAt);

    // Seed a second completed extraction of the identical documents. The queue
    // path is tested separately; this checks acknowledgement across batches.
    const originalBatch = await database.ocrImportBatch.findUniqueOrThrow({ where: { id: batch.id } });
    assert(originalBatch.result);
    const repeated = await database.ocrImportBatch.create({ data: {
      driverId: owner, clientMutationId: randomUUID(), requestHash: 'repeated-extraction-fixture',
      hints: { mode: 'auto', platform: null }, result: originalBatch.result as Prisma.InputJsonObject,
      uploadExpiresAt: originalBatch.uploadExpiresAt, expiresAt: originalBatch.expiresAt,
    } });
    assert.equal((await store.get(owner, repeated.id)).confirmations.length, 2);
    assert.equal((await confirmations.confirm(owner, repeated.id, { items: [second] })).saved[0].tripId, retried.saved[0].tripId);
    await store.cancel(owner, batch.id);
    assert.equal((await confirmations.confirm(owner, batch.id, { items: [first] })).saved[0].deleted, true);
    await database.ocrImportBatch.delete({ where: { id: batch.id } });
    assert.equal((await confirmations.confirm(owner, repeated.id, { items: [second] })).saved[0].tripId, retried.saved[0].tripId);
    const retained = await database.ocrTripConfirmation.findUniqueOrThrow({ where: { id: history.id } });
    assert.equal(retained.batchId, null); assert.deepEqual(retained.confirmed, history.confirmed);
  } finally {
    await database.trip.deleteMany({ where: { driverId: owner } });
    await database.appDailyAggregate.deleteMany({ where: { driverAppId: app.id } });
    await database.driverApp.delete({ where: { id: app.id } });
    await database.vehicle.deleteMany({ where: { id: { in: [vehicle.id, foreignVehicle.id] } } });
    await database.appSource.delete({ where: { id: source.id } });
  }
}
