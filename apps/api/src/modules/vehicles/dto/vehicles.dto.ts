import { z } from 'zod';
import { CreateVehicleSchema, UpdateVehicleSchema, UpdateVehicleCostsSchema, vehicleSchema } from '@ehsbha/api-contracts';
export { CreateVehicleSchema, UpdateVehicleSchema, UpdateVehicleCostsSchema, vehicleSchema as VehicleResponseSchema };
export interface CreateVehicleDto {
  type: z.infer<typeof CreateVehicleSchema>['type']; fuelType: z.infer<typeof CreateVehicleSchema>['fuelType'];
  make?: string; model?: string; year?: number; tankLiters: number; baselineKmPerLiter: number; odometerMeters?: number | null; isActive: boolean;
}
export interface UpdateVehicleDto extends Partial<CreateVehicleDto> { expectedOdometerVersion?: number }
export interface UpdateVehicleCostsDto {
  fuelTankCostPiastres?: number | null; fuelTankKmRange?: number | null; oilCostPiastres?: number | null; oilIntervalKm?: number | null;
  tireCostPiastres?: number | null; tireIntervalKm?: number | null; brakesCostPiastres?: number | null; brakesIntervalKm?: number | null;
  chainCostPiastres?: number | null; chainIntervalKm?: number | null; batteryCostPiastres?: number | null; batteryIntervalMonths?: number | null;
  monthlyMaintCostPiastres?: number | null; monthlyAvgKm?: number | null;
}
