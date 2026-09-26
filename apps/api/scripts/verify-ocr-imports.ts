import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { OcrDocumentStatus, OcrImportStatus, createOcrImportRequestSchema, ocrImportDetailSchema, ocrImportListSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { OcrImportStore } from '../src/modules/ocr/imports/ocr-import-store.service';
import { OcrImportWorker } from '../src/modules/ocr/imports/ocr-import.worker';
import { OcrService, type OcrImageUpload } from '../src/modules/ocr/ocr.service';
import { OcrModule } from '../src/modules/ocr/ocr.module';
import { OcrRecognitionProvider } from '../src/modules/ocr/ocr-recognition.provider';
import { SharpProcessor } from '../src/modules/ocr/image-processing/sharp.processor';
import type { ImageSignals } from '../src/modules/ocr/types';
import { verifyOcrConfirmations } from './verify-ocr-confirmations';
import { OcrConfirmationService } from '../src/modules/ocr/imports/ocr-confirmation.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

class FixtureProcessor extends SharpProcessor {
  override async prepare(buffer: Buffer): Promise<Buffer> { return buffer; }
}
class FixtureRecognition extends OcrRecognitionProvider {
  calls = 0;
  override async recognize(buffer: Buffer): Promise<ImageSignals> {
    this.calls += 1;
    const text = buffer.toString();
    if (text.includes('temporary-provider-failure')) throw new Error('Private provider detail');
    if (text.includes('invalid-image')) throw new BadRequestException({ code: 'OCR_IMAGE_INVALID' });
    const lines = text.split('\n').map((line, index) => ({
      text: line, meanConfidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 },
      words: [{ text: line, confidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 } }],
    }));
    return { read: { text, lines, words: lines.flatMap((line) => line.words), meanConfidence: 0.98 }, receipt: null };
  }
}
function image(text: string): OcrImageUpload {
  const buffer = Buffer.from(text);
  return { buffer, size: buffer.length, mimetype: 'image/png' };
}
function manifest(images: OcrImageUpload[], key: string = randomUUID()) {
  return createOcrImportRequestSchema.parse({ clientMutationId: key, hints: { mode: 'auto', platform: null }, images: images.map((file) => ({
    imageHash: createHash('sha256').update(file.buffer).digest('hex'), size: file.size, mimeType: file.mimetype,
  })) });
}

/** Real PostgreSQL, real parser/assembly, deterministic provider; no cloud calls. */
export async function verifyOcrImports(database: PrismaClient): Promise<void> {
  const recognition = new FixtureRecognition();
  const module = await Test.createTestingModule({ imports: [PrismaModule, OcrModule] })
    .overrideProvider(PrismaService).useValue(database)
    .overrideProvider(OcrRecognitionProvider).useValue(recognition)
    .overrideProvider(SharpProcessor).useClass(FixtureProcessor).compile();
  const store = module.get(OcrImportStore);
  const ocr = module.get(OcrService);
  const worker = module.get(OcrImportWorker);
  const suffix = randomUUID();
  const createDriver = async (label: string) => database.user.create({ data: {
    phone: `ocr-import-${label}-${suffix}`, passwordHash: 'unusable-test-password-hash', driver: { create: { displayName: 'Import integration fixture' } },
  }, include: { driver: true } });
  const a = await createDriver('a');
  const b = await createDriver('b');
  const c = await createDriver('c');
  assert(a.driver); assert(b.driver); assert(c.driver);
  const owner = a.driver.id;
  const stranger = b.driver.id;
  const good = image('Uber\nالأجرة 85.00 ج.م.');
  const other = image('Careem\ncustomer pays EGP 100.00');
  const bad = image('invalid-image');
  const files = [good, good, bad, other];
  try {
    const input = manifest(files);
    const [created, replay] = await Promise.all([store.create(owner, input), store.create(owner, input)]);
    assert.equal(created.id, replay.id);
    assert.equal(await database.ocrImportBatch.count({ where: { driverId: owner } }), 1);
    assert.equal(created.images[1].duplicateOf, created.images[0].id);
    const reservation = await database.ocrImportImage.aggregate({ where: { batchId: created.id }, _sum: { reservedBytes: true } });
    assert.equal(reservation._sum.reservedBytes, good.size + bad.size + other.size);
    await assert.rejects(store.create(owner, { ...input, hints: { ...input.hints, mode: 'single' } }), ConflictException);
    await assert.rejects(store.get(stranger, created.id), NotFoundException);
    await assert.rejects(store.cancel(stranger, created.id), NotFoundException);
    await assert.rejects(store.assertUploadOwner(stranger, created.id, created.images[0].id), NotFoundException);
    await assert.rejects(store.upload(stranger, created.id, created.images[0].id, good), NotFoundException);
    await assert.rejects(store.upload(owner, created.id, created.images[0].id, other), BadRequestException);
    assert.equal((await store.list(stranger, { limit: 10 })).items.length, 0);
    await assert.rejects(store.list(stranger, { limit: 10, cursor: created.id }), NotFoundException);
    for (const [index, file] of files.entries()) {
      await store.upload(owner, created.id, created.images[index].id, file);
      await store.upload(owner, created.id, created.images[index].id, file);
    }
    // Independent callers share a fleet-wide two-worker limit.
    const claims = await Promise.all([store.claim(), store.claim(), store.claim(), store.claim()]);
    const leases = claims.filter((lease) => lease !== null);
    assert.equal(leases.length, 2);
    for (const lease of leases) {
      assert(lease.image.payload);
      const extraction = await ocr.extractDocument({ buffer: Buffer.from(lease.image.payload), mimetype: lease.image.mimeType, size: lease.image.size }, lease.image.imageHash, lease.image.index, null, false);
      assert.equal(await store.finish(lease, extraction), true);
      assert.equal(await store.finish(lease, extraction), false);
    }
    await worker.tick();
    const complete = ocrImportDetailSchema.parse(await store.get(owner, created.id));
    assert.equal(complete.status, OcrImportStatus.Review);
    assert.equal(complete.finishedImageCount, 4);
    assert.equal(recognition.calls, 3);
    assert.equal(complete.result?.trips.length, 2);
    assert.deepEqual(complete.result?.documents?.map((doc) => doc.status), [OcrDocumentStatus.Completed, OcrDocumentStatus.Duplicate, OcrDocumentStatus.Failed, OcrDocumentStatus.Completed]);
    assert.equal(await database.ocrImportImage.count({ where: { batchId: created.id, payload: { not: null } } }), 0);
    assert.equal(await database.trip.count({ where: { driverId: owner } }), 0);
    assert.equal(ocrImportListSchema.parse(await store.list(owner, { limit: 1 })).items[0].status, OcrImportStatus.Review);
    assert(!JSON.stringify(complete).includes('payload'));

    // A new service/client can resume persisted evidence without re-recognition.
    const restartedStore = new OcrImportStore(module.get(PrismaService), ocr);
    const restored = await restartedStore.get(owner, created.id);
    assert.deepEqual(restored.result, complete.result);
    await store.upload(owner, created.id, created.images[0].id, good);
    assert.equal(recognition.calls, 3);

    // Crash recovery: a new token fences out a late worker from the old lease.
    const recovery = await store.create(owner, manifest([good]));
    await store.upload(owner, recovery.id, recovery.images[0].id, good);
    const abandoned = await store.claim(); assert(abandoned);
    await database.ocrImportImage.update({ where: { id: abandoned.image.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const recovered = await store.claim(); assert(recovered);
    assert.notEqual(abandoned.token, recovered.token);
    assert.equal(recovered.image.attempts, 2);
    const extraction = await ocr.extractDocument(good, recovered.image.imageHash, recovered.image.index, null, false);
    assert.equal(await store.finish(abandoned, extraction), false);
    assert.equal(await store.finish(recovered, extraction), true);

    // Cancellation erases private evidence and prevents a late worker restoring it.
    const cancellation = await store.create(owner, manifest([other]));
    await store.upload(owner, cancellation.id, cancellation.images[0].id, other);
    const cancelledLease = await store.claim(); assert(cancelledLease);
    await assert.rejects(store.finish(cancelledLease, extraction), /OCR_EXTRACTION_SOURCE_MISMATCH/);
    await store.cancel(owner, cancellation.id);
    assert.equal(await store.finish(cancelledLease, extraction), false);
    assert.equal((await store.get(owner, cancellation.id)).status, OcrImportStatus.Cancelled);
    assert.equal((await database.ocrImportImage.findUniqueOrThrow({ where: { id: cancelledLease.image.id } })).payload, null);
    await assert.rejects(store.upload(owner, cancellation.id, cancellation.images[0].id, other), ConflictException);

    // Retryable failures have a bounded attempt count and release their source.
    const transient = image('temporary-provider-failure');
    const failure = await store.create(owner, manifest([transient]));
    await store.upload(owner, failure.id, failure.images[0].id, transient);
    for (let attempt = 0; attempt < 3; attempt++) {
      await database.ocrImportImage.update({ where: { id: failure.images[0].id }, data: { availableAt: new Date(0) } });
      await worker.tick();
    }
    const failed = await store.get(owner, failure.id);
    assert.equal(failed.status, OcrImportStatus.Review);
    assert.equal(failed.images[0].attempts, 3);
    assert.equal(failed.result?.documents?.[0].errorCode, 'OCR_FAILED');
    assert(!JSON.stringify(failed).includes('Private provider detail'));

    // Upload expiry produces an actionable terminal result; evidence expires later.
    const expired = await store.create(owner, manifest([good]));
    await database.ocrImportBatch.update({ where: { id: expired.id }, data: { uploadExpiresAt: new Date(0) } });
    await store.cleanup();
    assert.equal((await store.get(owner, expired.id)).result?.documents?.[0].errorCode, 'OCR_IMPORT_EXPIRED');
    await database.ocrImportBatch.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    await store.cleanup();
    await assert.rejects(store.get(owner, expired.id), NotFoundException);

    // Three pending manifests per driver bound abandoned upload reservations.
    for (let index = 0; index < 3; index++) await store.create(stranger, manifest([good]));
    await assert.rejects(store.create(stranger, manifest([good])), (error: Error) => error instanceof HttpException && error.getStatus() === 429);
    await assert.rejects(store.create(owner, manifest([good], input.clientMutationId)), ConflictException);
    for (const batch of (await store.list(stranger, { limit: 10 })).items) await store.cancel(stranger, batch.id);
    const otherDriver = await store.create(stranger, input);
    assert.notEqual(otherDriver.id, created.id);
    await store.cancel(stranger, otherDriver.id);
    const reservationOnly = createOcrImportRequestSchema.parse({
      ...input, images: Array.from({ length: 8 }, (_, index) => ({
        imageHash: createHash('sha256').update(`quota-${index}`).digest('hex'), size: 5 * 1024 * 1024, mimeType: 'image/png',
      })),
    });
    // Six legitimate 40 MiB reservations fit; another driver cannot exceed
    // the shared 256 MiB capacity by creating a separate account's batch.
    for (const driverId of [owner, stranger]) {
      for (let index = 0; index < 3; index++) await store.create(driverId, { ...reservationOnly, clientMutationId: randomUUID() });
    }
    await assert.rejects(store.create(c.driver.id, reservationOnly), (error: Error) => error instanceof HttpException && error.getStatus() === 503);
    assert.equal(await database.ocrImportBatch.count({ where: { driverId: c.driver.id } }), 0);
    await verifyOcrConfirmations({ database, prisma: module.get(PrismaService), store, batch: complete, owner, stranger,
      confirmations: module.get(OcrConfirmationService), trips: module.get(TripsService), aggregates: module.get(AggregatesService) });
  } finally {
    await database.user.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    await module.close();
  }
}
