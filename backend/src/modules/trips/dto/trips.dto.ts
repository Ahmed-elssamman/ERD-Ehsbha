import { z } from 'zod';

export const CreateTripSchema = z.object({
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().min(1).nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  grossPiastres: z.number().int().min(0),
  tipPiastres: z.number().int().min(0).default(0),
  commissionPiastres: z.number().int().min(0).default(0),
  totalKmMeters: z.number().int().min(0),
  paidKmMeters: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).superRefine((v, ctx) => {
  if (v.endedAt <= v.startedAt) {
    ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'endedAt must be after startedAt' });
  }
  if (v.paidKmMeters > v.totalKmMeters) {
    ctx.addIssue({ code: 'custom', path: ['paidKmMeters'], message: 'paidKm cannot exceed totalKm' });
  }
});
export type CreateTripDto = z.infer<typeof CreateTripSchema>;

export const UpdateTripSchema = CreateTripSchema.innerType().partial();
export type UpdateTripDto = z.infer<typeof UpdateTripSchema>;

export const ListTripsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  appId: z.string().optional(),
  areaId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListTripsDto = z.infer<typeof ListTripsSchema>;
