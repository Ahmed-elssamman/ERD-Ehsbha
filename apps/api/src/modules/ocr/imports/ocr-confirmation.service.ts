import { TripRecordSource } from '@ehsbha/shared-types';
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ocrConfirmationRequestSchema, ocrExtractResponseSchema,
  type OcrConfirmationRequest, type OcrConfirmationResponse, type OcrConfirmationItem, type OcrConfirmationReceipt,
} from '@ehsbha/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import { lockDriverWrites } from '../../../common/authorization/driver-write-lock';
import { assertDriverReferences } from '../../../common/authorization/driver-ownership';
import { TripsService } from '../../trips/trips.service';
import { CreateTripSchema } from '../../trips/dto/trips.dto';
import { confirmationHash, confirmationReceipt, confirmationSnapshot, correctedFields, originalSnapshot } from './ocr-confirmation-mapper';

@Injectable()
export class OcrConfirmationService {
  constructor(private prisma: PrismaService, private trips: TripsService) {}

  async confirm(driverId: string, batchId: string, request: OcrConfirmationRequest): Promise<OcrConfirmationResponse> {
    const batch = await this.prisma.ocrImportBatch.findFirst({ where: { id: batchId, driverId }, select: { id: true } });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    const validated = ocrConfirmationRequestSchema.safeParse(request);
    if (!validated.success) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
    const response: OcrConfirmationResponse = { saved: [], failed: [] };
    // Each candidate and its aggregates/history/receipt form one transaction.
    // A rejected reference does not discard the driver's other valid cards.
    for (const item of validated.data.items) {
      try { response.saved.push(await this.confirmOne(driverId, batchId, item)); }
      catch (error) { response.failed.push({ candidateId: item.candidateId, code: safeConfirmationError(error instanceof Error ? error : new Error()) }); }
    }
    return response;
  }

  private async confirmOne(driverId: string, batchId: string, item: OcrConfirmationItem): Promise<OcrConfirmationReceipt> {
    const dto = CreateTripSchema.parse({ ...item.trip, clientMutationId: item.candidateId });
    const snapshot = confirmationSnapshot(dto);
    const requestHash = confirmationHash(snapshot);
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const locked = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now FROM ocr_import_batches WHERE id = ${batchId} AND driver_id = ${driverId} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException({ code: 'NOT_FOUND' });
      const batch = await tx.ocrImportBatch.findUniqueOrThrow({ where: { id: batchId } });
      const previous = await tx.ocrTripConfirmation.findUnique({ where: { driverId_candidateId: { driverId, candidateId: item.candidateId } }, include: { trip: { select: { deletedAt: true } } } });
      await assertDriverReferences(tx, driverId, dto);
      if (previous?.batchId === batchId) {
        if (previous.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        return confirmationReceipt(previous);
      }
      if (batch.cancelledAt || batch.expiresAt <= locked[0].now) throw new ConflictException({ code: 'OCR_IMPORT_CLOSED' });
      const result = ocrExtractResponseSchema.safeParse(batch.result);
      const candidate = result.success ? result.data.trips.find((trip) => trip.evidence?.id === item.candidateId) : null;
      if (!candidate) throw new BadRequestException({ code: 'OCR_CANDIDATE_NOT_FOUND' });
      if (previous) {
        if (previous.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        return confirmationReceipt(previous);
      }
      const vehicle = await tx.vehicle.findFirst({ where: { id: dto.vehicleId, driverId, isActive: true }, select: { id: true } });
      const app = await tx.driverApp.findFirst({ where: { id: dto.driverAppId, driverId, enabled: true }, select: { id: true } });
      if (!vehicle || !app) throw new BadRequestException({ code: 'OCR_REFERENCE_INACTIVE' });
      const trip = await this.trips.createInTransaction(tx, driverId, dto, TripRecordSource.Ocr);
      const record = await tx.ocrTripConfirmation.create({ data: {
        driverId, batchId, candidateId: item.candidateId, tripId: trip.id, originalTripId: trip.id,
        requestHash, original: originalSnapshot(candidate), confirmed: snapshot, correctedFields: correctedFields(candidate, snapshot),
      } });
      return confirmationReceipt(record);
    }, { timeout: 15000 });
  }
}

function safeConfirmationError(error: Error): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && 'code' in response && typeof response.code === 'string' &&
      /^(?:NOT_FOUND|VALIDATION_ERROR|TRIP_FINANCIAL_EVIDENCE_INVALID|DAILY_DISTANCE_CONFLICT|IDEMPOTENCY_KEY_REUSED|OCR_IMPORT_CLOSED|OCR_CANDIDATE_NOT_FOUND|OCR_REFERENCE_INACTIVE)$/.test(response.code)) return response.code;
  }
  return 'OCR_CONFIRMATION_RETRY';
}
