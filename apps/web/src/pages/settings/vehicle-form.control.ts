import { z } from 'zod';
import { FuelKind } from '@ehsbha/shared-types';
import type { Vehicle } from '@/lib/api/endpoints';

export const VEHICLE_FUEL_TYPES = Object.values(FuelKind);
export const vehicleSchema = z.object({
  type: z.enum(['CAR', 'BIKE']),
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  fuelType: z.enum(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC']),
  tankLiters: z.coerce.number().int().min(1).max(500).default(45),
  baselineKmPerLiter: z.coerce.number().min(1).max(100).default(12),
  odometerKm: z.string().trim().refine((value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number.isSafeInteger(Number(value) * 1000)), 'mileage-invalid'),
});
export type VehicleForm = z.input<typeof vehicleSchema>;

export function valuesFor(v: Vehicle | null): VehicleForm {
  const blankVehicle: VehicleForm = {
    type: 'CAR',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    fuelType: 'PETROL_92',
    tankLiters: 45,
    baselineKmPerLiter: 12,
    odometerKm: '',
  };

  if (!v) return blankVehicle;
  return {
          type: v.type,
          make: v.make ?? '',
          model: v.model ?? '',
          year: v.year ?? new Date().getFullYear(),
          fuelType: v.fuelType,
          tankLiters: v.tankLiters,
          baselineKmPerLiter: v.baselineKmPerLiter,
          odometerKm: '',
  };
}
