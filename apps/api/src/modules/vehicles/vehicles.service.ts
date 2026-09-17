import { VehicleOdometerSource } from '@prisma/client';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { reconcileVehicleOdometer } from './vehicle-odometer';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateVehicleDto,
  UpdateVehicleCostsDto,
  UpdateVehicleDto,
} from './dto/vehicles.dto';
import { computeVehicleCostPerKm } from '../analytics/engines/vehicle-cost.engine';

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a vehicle is not found for the given driver
 * - {@link GOVERNED_ERROR_REGISTRY.VALIDATION_ERROR} - when input data fails validation
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when user lacks permission to access the vehicle
 */
@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  list(driverId: string) {
    return this.prisma.vehicle.findMany({
      where: { driverId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(driverId: string, id: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, driverId } });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vehicle not found' });
    return v;
  }

  create(driverId: string, dto: CreateVehicleDto) {
    const recordedAt = new Date();
    return this.prisma.vehicle.create({
      data: {
        driverId,
        type: dto.type,
        make: dto.make ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        fuelType: dto.fuelType,
        tankLiters: dto.tankLiters,
        baselineKmPerLiter: dto.baselineKmPerLiter,
        odometerMeters: BigInt(dto.odometerMeters ?? 0),
        odometerBaselineMeters: dto.odometerMeters == null ? null : BigInt(dto.odometerMeters),
        odometerBaselineAt: dto.odometerMeters == null ? null : recordedAt,
        odometerBaselineSource: dto.odometerMeters == null ? VehicleOdometerSource.UNKNOWN : VehicleOdometerSource.MANUAL,
        odometerSource: dto.odometerMeters == null ? VehicleOdometerSource.UNKNOWN : VehicleOdometerSource.MANUAL,
        odometerAsOf: dto.odometerMeters == null ? null : recordedAt,
        isActive: dto.isActive,
      },
    });
  }

  async update(driverId: string, id: string, dto: UpdateVehicleDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      const existing = await tx.vehicle.findFirst({ where: { id, driverId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      const { odometerMeters, expectedOdometerVersion, ...changes } = dto;
      if ('odometerMeters' in dto) {
        if (existing.odometerVersion !== expectedOdometerVersion) throw new ConflictException({ code: 'VEHICLE_ODOMETER_CONFLICT' });
        const recordedAt = new Date();
        await tx.vehicle.update({ where: { id }, data: { ...changes,
          odometerBaselineMeters: odometerMeters == null ? null : BigInt(odometerMeters),
          odometerBaselineAt: odometerMeters == null ? null : recordedAt,
          odometerBaselineSource: odometerMeters == null ? VehicleOdometerSource.UNKNOWN : VehicleOdometerSource.MANUAL,
          odometerVersion: { increment: 1 } } });
        await reconcileVehicleOdometer(tx, driverId, id, recordedAt);
        await tx.recommendation.updateMany({ where: { driverId, expiresAt: { gt: recordedAt } }, data: { expiresAt: recordedAt } });
      } else await tx.vehicle.update({ where: { id }, data: changes });
      return tx.vehicle.findUniqueOrThrow({ where: { id } });
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async remove(driverId: string, id: string) {
    await this.get(driverId, id);
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async updateCosts(driverId: string, id: string, dto: UpdateVehicleCostsDto) {
    await this.get(driverId, id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async costSummary(driverId: string, id: string) {
    const v = await this.get(driverId, id);
    const summary = computeVehicleCostPerKm({
      fuelTankCostPiastres: v.fuelTankCostPiastres,
      fuelTankKmRange: v.fuelTankKmRange,
      oilCostPiastres: v.oilCostPiastres,
      oilIntervalKm: v.oilIntervalKm,
      tireCostPiastres: v.tireCostPiastres,
      tireIntervalKm: v.tireIntervalKm,
      brakesCostPiastres: v.brakesCostPiastres,
      brakesIntervalKm: v.brakesIntervalKm,
      chainCostPiastres: v.chainCostPiastres,
      chainIntervalKm: v.chainIntervalKm,
      batteryCostPiastres: v.batteryCostPiastres,
      batteryIntervalMonths: v.batteryIntervalMonths,
      monthlyMaintCostPiastres: v.monthlyMaintCostPiastres,
      monthlyAvgKm: v.monthlyAvgKm,
    });
    return { vehicleId: v.id, ...summary };
  }
}
