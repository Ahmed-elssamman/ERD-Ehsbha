import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type FuelLog } from '@prisma/client';
import { FuelChange } from '@ehsbha/shared-types';
import { CreateFuelSchema, UpdateFuelSchema, ListFuelSchema, type CreateFuelRequest, type UpdateFuelRequest, type FuelListRequest } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { assertDriverReferences } from '../../common/authorization/driver-ownership';
import { assertMutationMatches } from '../../common/utils/mutation-payload';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { reconcileVehicleOdometer } from '../vehicles/vehicle-odometer';
import { fuelSnapshot, recordFuelChange } from './fuel-history';
import { validateFuelLink } from './fuel-links';
export { CreateFuelSchema, UpdateFuelSchema, ListFuelSchema };
export type CreateFuelDto = CreateFuelRequest;
export type UpdateFuelDto = UpdateFuelRequest;
export type ListFuelDto = FuelListRequest;

@Injectable()
export class FuelService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async create(driverId: string, dto: CreateFuelDto) {
    return this.prisma.$transaction((tx) => this.createInTransaction(tx, driverId, dto), { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async createInTransaction(tx: Prisma.TransactionClient, driverId: string, dto: CreateFuelDto): Promise<FuelLog> {
    await lockDriverWrites(tx, driverId);
    await assertDriverReferences(tx, driverId, dto);
    if (dto.clientMutationId) {
      const duplicate = await tx.fuelLog.findUnique({ where: { driverId_clientMutationId: { driverId, clientMutationId: dto.clientMutationId } } });
      if (duplicate) { assertMutationMatches(dto, { ...duplicate, ...fuelSnapshot(duplicate), dateTime: duplicate.dateTime }); return duplicate; }
    }
    await validateFuelLink(tx, driverId, { ...dto, linkedExpenseId: dto.linkedExpenseId ?? null });
    const created = await tx.fuelLog.create({ data: { ...dto, driverId, odometerMeters: dto.odometerMeters === null ? null : BigInt(dto.odometerMeters) } });
    await this.refresh(tx, driverId, [created]);
    await recordFuelChange(tx, created, FuelChange.Created);
    return created;
  }

  async update(driverId: string, id: string, dto: UpdateFuelDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, id, dto.expectedVersion);
      if (existing.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND' });
      await assertDriverReferences(tx, driverId, dto);
      const { expectedVersion: _version, ...changes } = dto;
      const odometerMeters = 'odometerMeters' in changes ? (changes.odometerMeters == null ? null : BigInt(changes.odometerMeters)) : existing.odometerMeters;
      const next = { ...existing, ...changes, odometerMeters };
      await validateFuelLink(tx, driverId, next, id, existing.linkedExpenseId);
      const updated = await tx.fuelLog.update({ where: { id }, data: { ...changes, odometerMeters, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing, updated]);
      await recordFuelChange(tx, updated, FuelChange.Updated, existing);
      return updated;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async remove(driverId: string, id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, id, expectedVersion);
      if (existing.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND' });
      const deleted = await tx.fuelLog.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing]);
      await recordFuelChange(tx, deleted, FuelChange.Deleted, existing);
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async restore(driverId: string, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, id, expectedVersion);
      if (!existing.deletedAt) return existing;
      await validateFuelLink(tx, driverId, existing, id, existing.linkedExpenseId);
      const restored = await tx.fuelLog.update({ where: { id }, data: { deletedAt: null, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [restored]);
      await recordFuelChange(tx, restored, FuelChange.Restored, existing);
      return restored;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  private async record(tx: Prisma.TransactionClient, driverId: string, id: string, version: number) {
    const row = await tx.fuelLog.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (row.version !== version) throw new ConflictException({ code: 'FUEL_VERSION_CONFLICT' });
    return row;
  }

  private async refresh(tx: Prisma.TransactionClient, driverId: string, rows: FuelLog[]): Promise<void> {
    const ids = [...new Set(rows.flatMap((row) => row.linkedExpenseId ? [row.linkedExpenseId] : []))];
    const expenses = ids.length ? await tx.expense.findMany({ where: { driverId, id: { in: ids } }, select: { dateTime: true } }) : [];
    await this.aggregates.refreshInstants(driverId, [...rows.map((row) => row.dateTime), ...expenses.map((row) => row.dateTime)], tx);
    for (const vehicleId of new Set(rows.map((row) => row.vehicleId))) await reconcileVehicleOdometer(tx, driverId, vehicleId);
  }
}
