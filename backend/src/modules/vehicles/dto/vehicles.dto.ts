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
