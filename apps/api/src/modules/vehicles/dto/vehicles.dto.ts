import { z } from 'zod';

const VehicleTypeEnum = z.enum(['CAR', 'BIKE']);
const FuelTypeEnum = z.enum(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC']);

export const CreateVehicleSchema = z.object({
  type: VehicleTypeEnum,
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: z.number().int().min(1980).max(2100).optional(),
  fuelType: FuelTypeEnum,
  tankLiters: z.number().int().min(1).max(500).default(45),
  baselineKmPerLiter: z.number().positive().max(100).default(12),
  odometerMeters: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;

export const UpdateVehicleSchema = CreateVehicleSchema.partial();
export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;

export const UpdateVehicleCostsSchema = z.object({
  fuelTankCostPiastres: z.number().int().min(0).nullable().optional(),
  fuelTankKmRange: z.number().int().min(1).max(2000).nullable().optional(),
  oilCostPiastres: z.number().int().min(0).nullable().optional(),
  oilIntervalKm: z.number().int().min(1).max(50000).nullable().optional(),
  tireCostPiastres: z.number().int().min(0).nullable().optional(),
  tireIntervalKm: z.number().int().min(1).max(200000).nullable().optional(),
  brakesCostPiastres: z.number().int().min(0).nullable().optional(),
  brakesIntervalKm: z.number().int().min(1).max(200000).nullable().optional(),
  chainCostPiastres: z.number().int().min(0).nullable().optional(),
  chainIntervalKm: z.number().int().min(1).max(100000).nullable().optional(),
  batteryCostPiastres: z.number().int().min(0).nullable().optional(),
  batteryIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
  monthlyMaintCostPiastres: z.number().int().min(0).nullable().optional(),
  monthlyAvgKm: z.number().int().min(100).max(20000).nullable().optional(),
});
export type UpdateVehicleCostsDto = z.infer<typeof UpdateVehicleCostsSchema>;
