import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateVehicleDto,
  UpdateVehicleCostsDto,
  UpdateVehicleDto,
} from './dto/vehicles.dto';
import { computeVehicleCostPerKm } from '../analytics/engines/vehicle-cost.engine';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  list(driverId: string) {
    return this.prisma.vehicle.findMany({
      where: { driverId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(driverId: string, id: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, driverId } });
    if (!v) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found' });
    return v;
  }

  create(driverId: string, dto: CreateVehicleDto) {
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
        odometerMeters: BigInt(dto.odometerMeters),
        isActive: dto.isActive,
      },
    });
  }

  async update(driverId: string, id: string, dto: UpdateVehicleDto) {
    await this.get(driverId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        odometerMeters: dto.odometerMeters !== undefined ? BigInt(dto.odometerMeters) : undefined,
      },
    });
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
