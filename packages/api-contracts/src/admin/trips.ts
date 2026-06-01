import { z } from 'zod';

export const AdminListTripsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  driverId: z.string().optional(),
  driverAppId: z.string().optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type AdminListTripsQuery = z.infer<typeof AdminListTripsQuerySchema>;

export const AdminTripRowSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driverPhone: z.string(),
  driverAppId: z.string(),
  appName: z.string(),
  areaId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int(),
  netProfitPiastres: z.number().int().nullable(),
  totalKmMeters: z.number().int(),
  deletedAt: z.string().nullable(),
});
export type AdminTripRow = z.infer<typeof AdminTripRowSchema>;
