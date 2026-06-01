import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { CreateTripDto, ListTripsDto, UpdateTripDto } from './dto/trips.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) {}

  async list(driverId: string, q: ListTripsDto) {
    const where: any = { driverId };
    if (q.from || q.to) {
      where.startedAt = {};
      if (q.from) where.startedAt.gte = q.from;
      if (q.to) where.startedAt.lte = q.to;
    }
    if (q.appId) where.driverAppId = q.appId;
    if (q.areaId) where.areaId = q.areaId;

    const cursor = q.cursor ? { id: q.cursor } : undefined;
    const items = await this.prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: q.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
    const hasNext = items.length > q.limit;
    const page = hasNext ? items.slice(0, q.limit) : items;
    return {
      items: page,
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(driverId: string, id: string) {
    const t = await this.prisma.trip.findFirst({ where: { id, driverId } });
    if (!t) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    return t;
  }

  async create(driverId: string, dto: CreateTripDto) {
    if (dto.clientMutationId) {
      const dup = await this.prisma.trip.findUnique({ where: { clientMutationId: dto.clientMutationId } });
      if (dup) return dup;
    }
    const emptyKmMeters = dto.totalKmMeters - dto.paidKmMeters;
    // If the driver entered what they actually received after the platform deduction,
    // derive the commission from that. Otherwise fall back to whatever was passed.
    const commissionPiastres = dto.receivedPiastres !== undefined && dto.receivedPiastres !== null
      ? Math.max(0, dto.grossPiastres - dto.receivedPiastres)
      : dto.commissionPiastres;
    const trip = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          driverId,
          vehicleId: dto.vehicleId,
          driverAppId: dto.driverAppId,
          areaId: dto.areaId ?? null,
          startedAt: dto.startedAt,
          endedAt: dto.endedAt,
          grossPiastres: dto.grossPiastres,
          receivedPiastres: dto.receivedPiastres ?? null,
          tipPiastres: dto.tipPiastres,
          commissionPiastres,
          tollPiastres: dto.tollPiastres,
          parkingPiastres: dto.parkingPiastres,
          totalKmMeters: dto.totalKmMeters,
          paidKmMeters: dto.paidKmMeters,
          emptyKmMeters,
          notes: dto.notes ?? null,
          clientMutationId: dto.clientMutationId ?? null,
        },
      });
      await this.aggregates.applyTrip({
        driverId,
        driverAppId: created.driverAppId,
        areaId: created.areaId,
        startedAt: created.startedAt,
        endedAt: created.endedAt,
        grossPiastres: created.grossPiastres,
        tipPiastres: created.tipPiastres,
        commissionPiastres: created.commissionPiastres,
        totalKmMeters: created.totalKmMeters,
        paidKmMeters: created.paidKmMeters,
        emptyKmMeters: created.emptyKmMeters,
        sign: 1,
      }, tx);
      return created;
    });
    return trip;
  }

  async update(driverId: string, id: string, dto: UpdateTripDto) {
    const existing = await this.get(driverId, id);
    return this.prisma.$transaction(async (tx) => {
      await this.aggregates.applyTrip({
        driverId,
        driverAppId: existing.driverAppId,
        areaId: existing.areaId,
        startedAt: existing.startedAt,
        endedAt: existing.endedAt,
        grossPiastres: existing.grossPiastres,
        tipPiastres: existing.tipPiastres,
        commissionPiastres: existing.commissionPiastres,
        totalKmMeters: existing.totalKmMeters,
        paidKmMeters: existing.paidKmMeters,
        emptyKmMeters: existing.emptyKmMeters,
        sign: -1,
      }, tx);

      const next = {
        ...existing,
        ...dto,
        emptyKmMeters: (dto.totalKmMeters ?? existing.totalKmMeters) - (dto.paidKmMeters ?? existing.paidKmMeters),
      };

      const updated = await tx.trip.update({
        where: { id },
        data: {
          vehicleId: dto.vehicleId ?? undefined,
          driverAppId: dto.driverAppId ?? undefined,
          areaId: dto.areaId === undefined ? undefined : dto.areaId,
          startedAt: dto.startedAt ?? undefined,
          endedAt: dto.endedAt ?? undefined,
          grossPiastres: dto.grossPiastres ?? undefined,
          tipPiastres: dto.tipPiastres ?? undefined,
          commissionPiastres: dto.commissionPiastres ?? undefined,
          totalKmMeters: dto.totalKmMeters ?? undefined,
          paidKmMeters: dto.paidKmMeters ?? undefined,
          emptyKmMeters: next.emptyKmMeters,
          notes: dto.notes === undefined ? undefined : dto.notes,
        },
      });

      await this.aggregates.applyTrip({
        driverId,
        driverAppId: updated.driverAppId,
        areaId: updated.areaId,
        startedAt: updated.startedAt,
        endedAt: updated.endedAt,
        grossPiastres: updated.grossPiastres,
        tipPiastres: updated.tipPiastres,
        commissionPiastres: updated.commissionPiastres,
        totalKmMeters: updated.totalKmMeters,
        paidKmMeters: updated.paidKmMeters,
        emptyKmMeters: updated.emptyKmMeters,
        sign: 1,
      }, tx);

      return updated;
    });
  }

  /**
   * Bulk-create N trips for a driver in ONE request. Each item is processed
   * inside its own transaction so a single failure (FK violation, validation
   * error, …) doesn't roll back the others. We deliberately run sequentially
   * — not Promise.all — because the aggregates upsert hits the same
   * `(driver, day, app)` row that all cards from the same screenshot would
   * map to, and concurrent transactions on that row contend on the unique
   * index and intermittently raise P2034 / P2002.
   *
   * Returns the successfully created trips plus a per-index error array so
   * the client can surface "saved X of N, Y failed" without ambiguity.
   */
  async createBatch(driverId: string, items: CreateTripDto[]) {
    const created: Awaited<ReturnType<TripsService['create']>>[] = [];
    const errors: Array<{ index: number; code: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const trip = await this.create(driverId, items[i]);
        created.push(trip);
      } catch (err) {
        const mapped = this.classifyError(err);
        errors.push({ index: i, ...mapped });
        this.logger.warn(
          `createBatch item ${i} failed: ${mapped.code} ${mapped.message}`,
        );
      }
    }

    return { created, errors };
  }

  /**
   * Bulk-delete N trips. Same sequential-transaction rationale as
   * `createBatch` — concurrent aggregate decrements race on the same
   * counter row.
   */
  async removeBatch(driverId: string, ids: string[]) {
    const deleted: string[] = [];
    const errors: Array<{ id: string; code: string; message: string }> = [];

    // Dedupe; preserve input order so the client can correlate.
    const seen = new Set<string>();
    const ordered = ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

    for (const id of ordered) {
      try {
        await this.remove(driverId, id);
        deleted.push(id);
      } catch (err) {
        const mapped = this.classifyError(err);
        errors.push({ id, ...mapped });
        this.logger.warn(
          `removeBatch trip ${id} failed: ${mapped.code} ${mapped.message}`,
        );
      }
    }

    return { deleted, errors };
  }

  private classifyError(err: unknown): { code: string; message: string } {
    if (err instanceof NotFoundException) {
      return { code: 'TRIP_NOT_FOUND', message: 'Trip not found' };
    }
    if (err instanceof ConflictException) {
      const r = err.getResponse() as { code?: string; message?: string };
      return { code: r?.code ?? 'CONFLICT', message: r?.message ?? 'Conflict' };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return { code: 'DUPLICATE', message: 'Already exists' };
      if (err.code === 'P2025') return { code: 'NOT_FOUND', message: 'Resource not found' };
      if (err.code === 'P2003') return { code: 'FOREIGN_KEY', message: 'Related resource missing' };
      return { code: `PRISMA_${err.code}`, message: err.message };
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
      return { code: 'PRISMA_VALIDATION', message: err.message };
    }
    if (err instanceof Error) return { code: 'UNKNOWN', message: err.message };
    return { code: 'UNKNOWN', message: 'Unknown error' };
  }

  async remove(driverId: string, id: string) {
    const existing = await this.get(driverId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.trip.delete({ where: { id } });
      await this.aggregates.applyTrip({
        driverId,
        driverAppId: existing.driverAppId,
        areaId: existing.areaId,
        startedAt: existing.startedAt,
        endedAt: existing.endedAt,
        grossPiastres: existing.grossPiastres,
        tipPiastres: existing.tipPiastres,
        commissionPiastres: existing.commissionPiastres,
        totalKmMeters: existing.totalKmMeters,
        paidKmMeters: existing.paidKmMeters,
        emptyKmMeters: existing.emptyKmMeters,
        sign: -1,
      }, tx);
    });
  }
}
