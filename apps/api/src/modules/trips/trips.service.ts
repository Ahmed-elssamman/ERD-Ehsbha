import { listTripRecords, tripHistory, type TripHistoryQuery } from './trip-queries';
import { recordTripChange } from './trip-history';
import { classifyTripError } from './trip-errors';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type Trip } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { CreateTripDto, CreateTripSchema, ListTripsDto, UpdateTripDto } from './dto/trips.dto';
import { assertDriverReferences } from '../../common/authorization/driver-ownership';
import { assertMutationMatches } from '../../common/utils/mutation-payload';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { resolveTripFinancials, TripRecordSource, TripChange, type TripVersionTarget } from '@ehsbha/shared-types';
import { validateLinkedTripFees } from '../expenses/expense-links';

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a trip is not found for the given driver
 * - {@link GOVERNED_ERROR_REGISTRY.CONFLICT} - when a conflict occurs during trip operations
 * - {@link GOVERNED_ERROR_REGISTRY.VALIDATION_ERROR} - when batch item input fails Zod validation
 */
@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) { }

  list(driverId: string, q: ListTripsDto) { return listTripRecords(this.prisma, driverId, q); }
  history(driverId: string, id: string, q: TripHistoryQuery) { return tripHistory(this.prisma, driverId, id, q); }

  async get(driverId: string, id: string) {
    const t = await this.prisma.trip.findFirst({ where: { id, driverId } });
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND' });
    return t;
  }

  async create(driverId: string, dto: CreateTripDto, source = TripRecordSource.Manual) {
    return this.prisma.$transaction((tx) => this.createInTransaction(tx, driverId, dto, source), { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async createInTransaction(tx: Prisma.TransactionClient, driverId: string, dto: CreateTripDto, source = TripRecordSource.Manual): Promise<Trip> {
    await lockDriverWrites(tx, driverId);
    await assertDriverReferences(tx, driverId, dto);
    const validated = CreateTripSchema.safeParse(dto);
    if (!validated.success) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
    const financials = resolveTripFinancials(dto);
    if (!financials) throw new BadRequestException({ code: 'TRIP_FINANCIAL_EVIDENCE_INVALID' });
    if (dto.clientMutationId) {
      const dup = await tx.trip.findUnique({
        where: { driverId_clientMutationId: { driverId, clientMutationId: dto.clientMutationId } },
      });
      if (dup) {
        const storedFinancials = resolveTripFinancials(dup);
        if (!storedFinancials) throw new BadRequestException({ code: 'TRIP_FINANCIAL_EVIDENCE_INVALID' });
        assertMutationMatches({ ...dto, ...financials }, { ...dup, ...storedFinancials });
        return dup;
      }
    }
    const emptyKmMeters = dto.totalKmMeters - dto.paidKmMeters;
    const created = await tx.trip.create({
      data: {
        driverId, source,
        vehicleId: dto.vehicleId,
        driverAppId: dto.driverAppId,
        areaId: dto.areaId ?? null,
        startedAt: dto.startedAt,
        endedAt: dto.endedAt,
        ...financials,
        earningsPiastres: BigInt(financials.earningsPiastres),
        tollPiastres: dto.tollPiastres,
        parkingPiastres: dto.parkingPiastres,
        totalKmMeters: dto.totalKmMeters,
        paidKmMeters: dto.paidKmMeters,
        emptyKmMeters,
        notes: dto.notes ?? null,
        pickup: dto.pickup ?? null,
        destination: dto.destination ?? null,
        paymentMethod: dto.paymentMethod ?? 'unknown',
        waitingFeePiastres: dto.waitingFeePiastres ?? null,
        clientMutationId: dto.clientMutationId ?? null,
      },
    });
    await recordTripChange(tx, created, TripChange.Created);
    await this.aggregates.refreshIntervals(driverId, [created], tx);
    return created;
  }

  async update(driverId: string, id: string, dto: UpdateTripDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.trip.findFirst({ where: { id, driverId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      await assertDriverReferences(tx, driverId, dto);
      if (existing.deletedAt || existing.version !== dto.expectedVersion) throw new ConflictException({ code: 'TRIP_VERSION_CONFLICT' });
      const { clientMutationId: _clientMutationId, ...stored } = existing;
      const { expectedVersion: _expectedVersion, ...patch } = dto;
      const combined = { ...stored, earningsPiastres: stored.earningsPiastres == null ? null : Number(stored.earningsPiastres), ...patch };
      // A money patch replaces the relevant equation; unrelated edits preserve every fact.
      const changesIncome = dto.grossPiastres !== undefined || dto.commissionPiastres !== undefined
        || dto.receivedPiastres !== undefined || dto.tipPiastres !== undefined || dto.earningsPiastres !== undefined;
      if (changesIncome) {
        if (combined.grossPiastres === null && combined.earningsPiastres !== null && dto.receivedPiastres === undefined) combined.receivedPiastres = null;
        if (dto.earningsPiastres != null) {
          if (dto.receivedPiastres === undefined) combined.receivedPiastres = null;
        } else if (combined.grossPiastres !== null && combined.commissionPiastres !== null) {
          combined.earningsPiastres = null;
          if (dto.receivedPiastres === undefined) combined.receivedPiastres = null;
          else if (dto.commissionPiastres === undefined) combined.commissionPiastres = null;
        } else if (dto.receivedPiastres != null) combined.earningsPiastres = null;
      }
      const shape = CreateTripSchema.innerType().strip().safeParse(combined);
      if (!shape.success) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
      const validated = CreateTripSchema.safeParse(shape.data);
      if (!validated.success) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
      const financials = resolveTripFinancials(validated.data);
      if (!financials) throw new BadRequestException({ code: 'TRIP_FINANCIAL_EVIDENCE_INVALID' });
      const next = { ...validated.data, ...financials, earningsPiastres: BigInt(financials.earningsPiastres) };
      await validateLinkedTripFees(tx, driverId, { ...next, id });
      const updated = await tx.trip.update({
        where: { id },
        data: {
          ...next, version: { increment: 1 },
          emptyKmMeters: next.totalKmMeters - next.paidKmMeters,
        },
      });

      await recordTripChange(tx, updated, TripChange.Updated, existing);
      await this.aggregates.refreshIntervals(driverId, [existing, updated], tx);

      return updated;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  /**
   * Bulk-create N trips for a driver in ONE request. Each item is processed
   * inside its own transaction so a single failure (FK violation, validation
   * error, …) doesn't roll back the others. Sequential processing limits
   * contention on the driver lock used by financial reconciliation.
   *
   * Returns the successfully created trips plus a per-index error array so
   * the client can surface "saved X of N, Y failed" without ambiguity.
   */
  async createBatch(driverId: string, items: unknown[]) {
    const created: Awaited<ReturnType<TripsService['create']>>[] = [];
    const errors: Array<{ index: number; code: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      // Validate each item individually so one bad card (common with OCR
      // noise) doesn't sink the whole batch — see BatchCreateTripsSchema.
      const parsed = CreateTripSchema.safeParse(items[i]);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
          .join('; ');
        errors.push({ index: i, code: 'VALIDATION_ERROR', message });
        this.logger.warn(`createBatch item ${i} invalid: ${message}`);
        continue;
      }
      try {
        const trip = await this.create(driverId, parsed.data);
        created.push(trip);
      } catch (err) {
        const mapped = err instanceof Error ? classifyTripError(err) : { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR' };
        errors.push({ index: i, ...mapped });
        this.logger.warn(
          `createBatch item ${i} failed: ${mapped.code} ${mapped.message}`,
        );
      }
    }

    return { created, errors };
  }

  /**
   * Bulk-delete N trips with independent, sequential source/projection transactions.
   */
  async removeBatch(driverId: string, items: TripVersionTarget[]) {
    const deleted: string[] = [];
    const errors: Array<{ id: string; code: string; message: string }> = [];

    for (const item of items) {
      const { id, expectedVersion } = item;
      try {
        await this.remove(driverId, id, expectedVersion);
        deleted.push(id);
      } catch (err) {
        const mapped = err instanceof Error ? classifyTripError(err) : { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR' };
        errors.push({ id, ...mapped });
        this.logger.warn(
          `removeBatch trip ${id} failed: ${mapped.code} ${mapped.message}`,
        );
      }
    }

    return { deleted, errors };
  }

  async remove(driverId: string, id: string, expectedVersion: number) {
    await this.changeDeletion(driverId, id, expectedVersion, new Date());
  }
  restore(driverId: string, id: string, expectedVersion: number) { return this.changeDeletion(driverId, id, expectedVersion, null); }
  private changeDeletion(driverId: string, id: string, expectedVersion: number, deletedAt: Date | null) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.trip.findFirst({ where: { id, driverId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (existing.version !== expectedVersion) throw new ConflictException({ code: 'TRIP_VERSION_CONFLICT' });
      if (!!existing.deletedAt === !!deletedAt) return existing;
      if (!deletedAt) await validateLinkedTripFees(tx, driverId, existing);
      const updated = await tx.trip.update({ where: { id }, data: { deletedAt, version: { increment: 1 } } });
      await recordTripChange(tx, updated, deletedAt ? TripChange.Deleted : TripChange.Restored, existing);
      await this.aggregates.refreshIntervals(driverId, [existing, updated], tx);
      return updated;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }
}
