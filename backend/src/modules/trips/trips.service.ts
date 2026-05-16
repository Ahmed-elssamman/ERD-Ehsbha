import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { CreateTripDto, ListTripsDto, UpdateTripDto } from './dto/trips.dto';

@Injectable()
export class TripsService {
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
