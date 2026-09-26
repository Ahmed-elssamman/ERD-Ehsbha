import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, OcrImportImageState } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  OcrDocumentStatus, ocrExtractRequestHintsSchema, type CreateOcrImportRequest,
  type OcrImportDetail, type OcrImportList, type OcrImportListQuery,
} from '@ehsbha/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import { OcrService, type DocumentExtraction, type OcrImageUpload } from '../ocr.service';
import {
  OCR_IMPORT_LOCK_KEY, OCR_IMPORT_LOCK_NAMESPACE, OCR_IMPORT_MAX_ATTEMPTS, OCR_IMPORT_MAX_PENDING_PER_DRIVER,
  OCR_IMPORT_REQUESTS_PER_HOUR, OCR_IMPORT_RESULT_TTL_MS, OCR_IMPORT_STORAGE_BYTES, OCR_IMPORT_UPLOAD_TTL_MS,
  OCR_IMPORT_LEASE_MS, OCR_IMPORT_WORKERS, OCR_IMPORT_RETRY_CODES, OCR_IMPORT_PENDING_IMAGES,
} from './ocr-import.control';
import { documentExtractionSchema, type OcrImportLease, type OcrImportWithImages } from './ocr-import.model';
import { importDetail, importSummary } from './ocr-import-mapper';
import { confirmationReceipt } from './ocr-confirmation-mapper';

const terminalStates: OcrImportImageState[] = [OcrImportImageState.completed, OcrImportImageState.failed, OcrImportImageState.duplicate];

/** PostgreSQL owns admission, leases and evidence. No financial writes occur here. */
@Injectable()
export class OcrImportStore {
  constructor(private prisma: PrismaService, private ocr: OcrService) {}

  async create(driverId: string, request: CreateOcrImportRequest): Promise<OcrImportDetail> {
    const requestHash = hash(JSON.stringify({ hints: request.hints, images: request.images }));
    const batch = await this.prisma.$transaction(async (tx) => {
      const now = await this.lock(tx);
      const existing = await tx.ocrImportBatch.findUnique({
        where: { driverId_clientMutationId: { driverId, clientMutationId: request.clientMutationId } },
        include: { images: { orderBy: { index: 'asc' }, omit: { payload: true } } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        return { ...existing, images: existing.images.map((image) => ({ ...image, payload: null })) };
      }
      const pending = await tx.ocrImportBatch.count({ where: {
        driverId, cancelledAt: null, uploadExpiresAt: { gt: now }, images: { some: { status: { in: [OcrImportImageState.awaiting_upload, OcrImportImageState.queued, OcrImportImageState.processing] } } },
      } });
      const recent = await tx.ocrImportBatch.count({ where: { driverId, createdAt: { gt: new Date(now.getTime() - 3600000) } } });
      if (pending >= OCR_IMPORT_MAX_PENDING_PER_DRIVER || recent >= OCR_IMPORT_REQUESTS_PER_HOUR) {
        throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      const ids = new Map<string, string>();
      const images = request.images.map((image, index) => {
        const duplicateOf = ids.get(image.imageHash) ?? null;
        const id = randomUUID();
        if (!duplicateOf) ids.set(image.imageHash, id);
        return { ...image, id, index, duplicateOf, status: duplicateOf ? OcrImportImageState.duplicate : OcrImportImageState.awaiting_upload, reservedBytes: duplicateOf ? 0 : image.size };
      });
      const usage = await tx.ocrImportImage.aggregate({ where: { reservedBytes: { gt: 0 } }, _sum: { reservedBytes: true }, _count: { _all: true } });
      const reservedBytes = images.reduce((sum, image) => sum + image.reservedBytes, 0);
      if ((usage._sum.reservedBytes ?? 0) + reservedBytes > OCR_IMPORT_STORAGE_BYTES || usage._count._all + ids.size > OCR_IMPORT_PENDING_IMAGES) {
        throw new HttpException({ code: 'OCR_BUSY' }, HttpStatus.SERVICE_UNAVAILABLE);
      }
      return tx.ocrImportBatch.create({ data: {
        driverId, clientMutationId: request.clientMutationId, requestHash, hints: { ...request.hints },
        uploadExpiresAt: new Date(now.getTime() + OCR_IMPORT_UPLOAD_TTL_MS),
        expiresAt: new Date(now.getTime() + OCR_IMPORT_RESULT_TTL_MS), images: { create: images },
      }, include: { images: { orderBy: { index: 'asc' } } } });
    });
    return importDetail(batch);
  }

  async get(driverId: string, id: string): Promise<OcrImportDetail> {
    const detail = importDetail(await this.ownedBatch(this.prisma, driverId, id));
    const candidateIds = detail.result?.trips.flatMap((trip) => trip.evidence ? [trip.evidence.id] : []) ?? [];
    const records = await this.prisma.ocrTripConfirmation.findMany({ where: { driverId, OR: [{ batchId: id }, { candidateId: { in: candidateIds } }] }, include: { trip: { select: { deletedAt: true } } } });
    detail.confirmations = records.map(confirmationReceipt);
    return detail;
  }

  async list(driverId: string, query: OcrImportListQuery): Promise<OcrImportList> {
    const cursor = query.cursor ? await this.prisma.ocrImportBatch.findFirst({ where: { id: query.cursor, driverId } }) : null;
    if (query.cursor && !cursor) throw new NotFoundException({ code: 'NOT_FOUND' });
    const batches = await this.prisma.ocrImportBatch.findMany({
      where: { driverId, cancelledAt: null, expiresAt: { gt: new Date() }, ...(cursor ? { OR: [
        { createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
      include: { images: { orderBy: { index: 'asc' }, omit: { payload: true, extraction: true } } },
      omit: { result: true },
    });
    // The list does not load image bytes or OCR text. Result availability is
    // inferred from terminal originals; detail reads return the full evidence.
    const items = batches.slice(0, query.limit).map((batch) => {
      const complete = batch.images.every((image) => terminalStates.includes(image.status));
      return importSummary({ ...batch, result: complete ? {} : null, images: batch.images.map((image) => ({ ...image, payload: null, extraction: null })) });
    });
    return { items, nextCursor: batches.length > query.limit ? items.at(-1)?.id ?? null : null };
  }

  async assertUploadOwner(driverId: string, id: string, imageId: string): Promise<void> {
    const image = await this.prisma.ocrImportImage.findFirst({ where: { id: imageId, batchId: id, batch: { driverId } }, select: { id: true } });
    if (!image) throw new NotFoundException({ code: 'NOT_FOUND' });
  }

  async upload(driverId: string, id: string, imageId: string, file: OcrImageUpload | null): Promise<OcrImportDetail> {
    if (!file || !file.buffer.length) throw new BadRequestException({ code: 'OCR_IMAGE_INVALID' });
    const digest = hash(file.buffer);
    const batch = await this.prisma.$transaction(async (tx) => {
      const now = await this.lock(tx);
      const batch = await this.ownedBatch(tx, driverId, id);
      const image = batch.images.find((item) => item.id === imageId);
      if (!image) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (batch.cancelledAt || batch.uploadExpiresAt <= now) throw new ConflictException({ code: 'OCR_IMPORT_CLOSED' });
      if (digest !== image.imageHash || file.buffer.length !== image.size || file.mimetype.toLowerCase() !== image.mimeType.toLowerCase()) {
        throw new BadRequestException({ code: 'OCR_IMAGE_INVALID' });
      }
      // The same accepted bytes are safe to replay after a lost HTTP response.
      if (image.status !== OcrImportImageState.awaiting_upload) return batch;
      await tx.ocrImportImage.update({ where: { id: image.id }, data: { payload: new Uint8Array(file.buffer), status: OcrImportImageState.queued, availableAt: new Date(0) } });
      return this.ownedBatch(tx, driverId, id);
    });
    return importDetail(batch);
  }

  async cancel(driverId: string, id: string): Promise<OcrImportDetail> {
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      await this.ownedBatch(tx, driverId, id);
      await tx.ocrImportImage.updateMany({ where: { batchId: id }, data: {
        payload: null, reservedBytes: 0, extraction: Prisma.DbNull, leaseUntil: null, leaseToken: null,
      } });
      return tx.ocrImportBatch.update({ where: { id }, data: { cancelledAt: new Date(), result: Prisma.DbNull }, include: { images: { orderBy: { index: 'asc' } } } });
    });
    return importDetail(batch);
  }

  async claim(): Promise<OcrImportLease | null> {
    return this.prisma.$transaction(async (tx) => {
      const now = await this.lock(tx);
      const active = await tx.ocrImportImage.count({ where: { status: OcrImportImageState.processing, leaseUntil: { gt: now } } });
      if (active >= OCR_IMPORT_WORKERS) return null;
      const image = await tx.ocrImportImage.findFirst({ where: {
        batch: { cancelledAt: null, uploadExpiresAt: { gt: now } },
        OR: [
          { status: OcrImportImageState.queued, availableAt: { lte: now } },
          { status: OcrImportImageState.processing, leaseUntil: { lte: now } },
        ],
      }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { batch: true } });
      if (!image) return null;
      if (image.attempts >= OCR_IMPORT_MAX_ATTEMPTS || !image.payload) {
        await tx.ocrImportImage.update({ where: { id: image.id }, data: {
          status: OcrImportImageState.failed, errorCode: 'OCR_FAILED', payload: null, reservedBytes: 0, leaseToken: null, leaseUntil: null,
        } });
        await this.finalize(tx, image.batchId);
        return null;
      }
      const token: string = randomUUID();
      const claimed = await tx.ocrImportImage.update({ where: { id: image.id }, data: {
        status: OcrImportImageState.processing, attempts: { increment: 1 }, leaseToken: token,
        leaseUntil: new Date(now.getTime() + OCR_IMPORT_LEASE_MS),
      } });
      return { image: claimed, batch: image.batch, token };
    });
  }

  async finish(lease: OcrImportLease, extraction: DocumentExtraction): Promise<boolean> {
    const parsed = documentExtractionSchema.parse(extraction);
    return this.prisma.$transaction(async (tx) => {
      const now = await this.lock(tx);
      const current = await tx.ocrImportImage.findFirst({ where: {
        id: lease.image.id, status: OcrImportImageState.processing, leaseToken: lease.token,
        leaseUntil: { gt: now }, batch: { cancelledAt: null, uploadExpiresAt: { gt: now } },
      } });
      if (!current) return false;
      if (parsed.document.imageHash !== current.imageHash || parsed.document.index !== current.index) {
        throw new Error('OCR_EXTRACTION_SOURCE_MISMATCH');
      }
      const failed = parsed.document.status === OcrDocumentStatus.Failed;
      const retry = failed && OCR_IMPORT_RETRY_CODES.has(parsed.document.errorCode ?? '') && current.attempts < OCR_IMPORT_MAX_ATTEMPTS;
      await tx.ocrImportImage.update({ where: { id: current.id }, data: {
        status: retry ? OcrImportImageState.queued : failed ? OcrImportImageState.failed : OcrImportImageState.completed,
        extraction: JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonObject,
        errorCode: parsed.document.errorCode, leaseToken: null, leaseUntil: null,
        availableAt: new Date(now.getTime() + current.attempts * 5000),
        ...(!retry ? { payload: null, reservedBytes: 0 } : {}),
      } });
      await this.finalize(tx, current.batchId);
      return true;
    });
  }

  async cleanup(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = await this.lock(tx);
      // Hard-expired evidence is deleted with its documents; cancellation keeps
      // only a receipt for safe replay until the same seven-day expiry.
      await tx.ocrImportBatch.deleteMany({ where: { expiresAt: { lte: now } } });
      const expired = await tx.ocrImportBatch.findMany({ where: {
        cancelledAt: null, uploadExpiresAt: { lte: now },
        images: { some: { status: { in: [OcrImportImageState.awaiting_upload, OcrImportImageState.queued, OcrImportImageState.processing] } } },
      }, select: { id: true }, take: 50 });
      for (const batch of expired) {
        await tx.ocrImportImage.updateMany({ where: {
          batchId: batch.id, status: { in: [OcrImportImageState.awaiting_upload, OcrImportImageState.queued, OcrImportImageState.processing] },
        }, data: { status: OcrImportImageState.failed, errorCode: 'OCR_IMPORT_EXPIRED', payload: null, reservedBytes: 0, leaseToken: null, leaseUntil: null } });
        await this.finalize(tx, batch.id);
      }
    }, { timeout: 15000 });
  }

  private async finalize(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const batch = await tx.ocrImportBatch.findUniqueOrThrow({ where: { id }, include: { images: { orderBy: { index: 'asc' } } } });
    if (batch.cancelledAt || batch.result || batch.images.some((image) => !terminalStates.includes(image.status))) return;
    const extractions: DocumentExtraction[] = batch.images.map((image) => {
      const original = image.duplicateOf ? batch.images.find((item) => item.id === image.duplicateOf) ?? image : image;
      const extraction: DocumentExtraction = original.extraction ? documentExtractionSchema.parse(original.extraction) : {
        document: { id: `${original.imageHash}:${original.index}`, imageHash: original.imageHash, index: original.index,
          status: OcrDocumentStatus.Failed, duplicateOf: null, errorCode: original.errorCode ?? 'OCR_FAILED', rawText: '', candidateIds: [] },
        trips: [], meanConfidence: 0,
      };
      if (original.status === OcrImportImageState.failed) {
        extraction.document.status = OcrDocumentStatus.Failed;
        extraction.document.errorCode = original.errorCode ?? 'OCR_FAILED';
      }
      if (!image.duplicateOf) return extraction;
      return { ...extraction, trips: [], document: {
        ...extraction.document, id: `${image.imageHash}:${image.index}`, index: image.index, duplicateOf: extraction.document.id,
        status: extraction.document.status === OcrDocumentStatus.Failed ? OcrDocumentStatus.Failed : OcrDocumentStatus.Duplicate,
      } };
    });
    const result = this.ocr.assembleDocuments(extractions, ocrExtractRequestHintsSchema.parse(batch.hints));
    await tx.ocrImportBatch.update({ where: { id }, data: { result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonObject } });
  }

  private async ownedBatch(tx: Prisma.TransactionClient, driverId: string, id: string): Promise<OcrImportWithImages> {
    const batch = await tx.ocrImportBatch.findFirst({
      where: { id, driverId }, include: { images: { orderBy: { index: 'asc' }, omit: { payload: true } } },
    });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    return { ...batch, images: batch.images.map((image) => ({ ...image, payload: null })) };
  }

  private async lock(tx: Prisma.TransactionClient): Promise<Date> {
    const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now FROM pg_advisory_xact_lock(${OCR_IMPORT_LOCK_NAMESPACE}::int, ${OCR_IMPORT_LOCK_KEY}::int)`;
    return rows[0].now;
  }
}

function hash(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
