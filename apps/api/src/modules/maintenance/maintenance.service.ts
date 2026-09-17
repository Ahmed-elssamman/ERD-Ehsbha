import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Prisma, type MaintenanceRecord } from '@prisma/client';
import { MaintenanceChange } from '@ehsbha/shared-types';
import { CreateMaintenanceRecordSchema, UpdateMaintenanceRecordSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { assertMutationMatches } from '../../common/utils/mutation-payload';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { computeMaintenanceRisk } from '../analytics/engines/maintenance.engine';
import { validateMaintenanceLink } from './maintenance-links';
import { recordMaintenanceChange } from './maintenance-history';
export { CreateMaintenanceRecordSchema, UpdateMaintenanceRecordSchema };
export type CreateMaintenanceRecordDto = z.infer<typeof CreateMaintenanceRecordSchema>;
export type UpdateMaintenanceRecordDto = z.infer<typeof UpdateMaintenanceRecordSchema>;

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  listItems() {
    return this.prisma.maintenanceItem.findMany({ orderBy: { name: 'asc' } });
  }

  async addRecord(driverId: string, vehicleId: string, dto: CreateMaintenanceRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      await this.validateItem(tx, driverId, vehicleId, dto.maintenanceItemId);
      if (dto.clientMutationId) {
        const duplicate = await tx.maintenanceRecord.findUnique({ where: { driverId_clientMutationId: { driverId, clientMutationId: dto.clientMutationId } } });
        if (duplicate) { assertMutationMatches({ ...dto, vehicleId, odometerMeters: BigInt(dto.odometerMeters) }, duplicate); return duplicate; }
      }
      await validateMaintenanceLink(tx, driverId, { ...dto, vehicleId, linkedExpenseId: dto.linkedExpenseId ?? null });
      const created = await tx.maintenanceRecord.create({ data: { ...dto, driverId, vehicleId, odometerMeters: BigInt(dto.odometerMeters) } });
      await this.refresh(tx, driverId, [created]);
      await recordMaintenanceChange(tx, created, MaintenanceChange.Created);
      return created;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async updateRecord(driverId: string, vehicleId: string, id: string, dto: UpdateMaintenanceRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, vehicleId, id, dto.expectedVersion);
      if (existing.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND' });
      const { expectedVersion: _version, ...changes } = dto;
      const next = { ...existing, ...changes, odometerMeters: BigInt(changes.odometerMeters ?? existing.odometerMeters) };
      await this.validateItem(tx, driverId, vehicleId, next.maintenanceItemId);
      await validateMaintenanceLink(tx, driverId, next, id, existing.linkedExpenseId);
      const updated = await tx.maintenanceRecord.update({ where: { id }, data: { ...changes, odometerMeters: next.odometerMeters, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing, updated]);
      await recordMaintenanceChange(tx, updated, MaintenanceChange.Updated, existing);
      return updated;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async removeRecord(driverId: string, vehicleId: string, id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, vehicleId, id, expectedVersion);
      if (existing.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND' });
      const deleted = await tx.maintenanceRecord.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      await this.refresh(tx, driverId, [existing]);
      await recordMaintenanceChange(tx, deleted, MaintenanceChange.Deleted, existing);
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async restoreRecord(driverId: string, vehicleId: string, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await this.record(tx, driverId, vehicleId, id, expectedVersion);
      if (!existing.deletedAt) return existing;
      await this.validateItem(tx, driverId, vehicleId, existing.maintenanceItemId);
      await validateMaintenanceLink(tx, driverId, existing, id, existing.linkedExpenseId);
      const restored = await tx.maintenanceRecord.update({ where: { id }, data: { deletedAt: null, version: { increment: 1 } } });
      await this.refresh(tx, driverId, [restored]);
      await recordMaintenanceChange(tx, restored, MaintenanceChange.Restored, existing);
      return restored;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  private async record(tx: Prisma.TransactionClient, driverId: string, vehicleId: string, id: string, version: number) {
    const row = await tx.maintenanceRecord.findFirst({ where: { id, driverId, vehicleId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (row.version !== version) throw new ConflictException({ code: 'MAINTENANCE_VERSION_CONFLICT' });
    return row;
  }

  private async validateItem(tx: Prisma.TransactionClient, driverId: string, vehicleId: string, itemId: string): Promise<void> {
    const vehicle = await tx.vehicle.findFirst({ where: { driverId, id: vehicleId }, select: { type: true } });
    const item = await tx.maintenanceItem.findUnique({ where: { id: itemId } });
    if (!vehicle || !item) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!(vehicle.type === 'CAR' ? item.appliesToCar : item.appliesToBike)) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
  }

  private async refresh(tx: Prisma.TransactionClient, driverId: string, rows: MaintenanceRecord[]): Promise<void> {
    const ids = [...new Set(rows.flatMap((row) => row.linkedExpenseId ? [row.linkedExpenseId] : []))];
    const expenses = ids.length ? await tx.expense.findMany({ where: { driverId, id: { in: ids } }, select: { dateTime: true } }) : [];
    await this.aggregates.refreshInstants(driverId, [...rows.map((row) => row.performedAt), ...expenses.map((row) => row.dateTime)], tx);
  }

  async risk(driverId: string, vehicleId: string) {
    const vehicle = await this.assertVehicleOwned(driverId, vehicleId);
    const items = await this.prisma.maintenanceItem.findMany();

    const applicable = items.filter((i) =>
      vehicle.type === 'CAR' ? i.appliesToCar : i.appliesToBike,
    );

    const now = new Date();
    const latest = await this.prisma.$queryRaw<Array<{ maintenanceItemId: string; performedAt: Date; odometerMeters: bigint }>>`
      SELECT DISTINCT ON (maintenance_item_id) maintenance_item_id AS "maintenanceItemId", performed_at AS "performedAt", odometer_meters AS "odometerMeters"
      FROM maintenance_records WHERE driver_id = ${driverId} AND vehicle_id = ${vehicleId} AND deleted_at IS NULL
        AND performed_at <= (${now}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY maintenance_item_id, performed_at DESC, id DESC`;
    const byItem = new Map(latest.map((row) => [row.maintenanceItemId, row]));
    const out = applicable.map((item) => {
      const last = byItem.get(item.id);
      const currentOdoMeters = vehicle.odometerSource === 'MANUAL' || vehicle.odometerSource === 'FUEL' ? Number(vehicle.odometerMeters) : null;
      const lastServiceOdoMeters = last ? Number(last.odometerMeters) : null;
      const { risk, status } = computeMaintenanceRisk({ currentOdoMeters, lastServiceOdoMeters, lastServiceAt: last?.performedAt ?? null,
        intervalKm: item.defaultIntervalKm, intervalDays: item.defaultIntervalDays, now });
      return { item, status, risk,
        kmSinceLastMeters: lastServiceOdoMeters !== null && currentOdoMeters !== null && currentOdoMeters >= lastServiceOdoMeters ? currentOdoMeters - lastServiceOdoMeters : null,
        daysSinceLast: last ? Math.floor((now.getTime() - last.performedAt.getTime()) / 86_400_000) : null,
        lastServiceAt: last?.performedAt ?? null };
    });
    out.sort((a, b) => (b.risk ?? -1) - (a.risk ?? -1) || a.item.id.localeCompare(b.item.id));
    return out;
  }

  private async assertVehicleOwned(driverId: string, vehicleId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, driverId } });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND' });
    return v;
  }
}
