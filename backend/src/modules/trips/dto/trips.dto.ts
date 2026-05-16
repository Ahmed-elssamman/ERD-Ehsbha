import { z } from 'zod';

export const CreateTripSchema = z.object({
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().min(1).nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  // What the app showed (price quoted to the customer)
  grossPiastres: z.number().int().min(0),
  // What the driver actually received after the platform's deduction.
  // If provided, the server derives commission = gross - received.
  // If omitted, the server falls back to the explicit commissionPiastres (if any).
  receivedPiastres: z.number().int().min(0).nullable().optional(),
  tipPiastres: z.number().int().min(0).default(0),
  commissionPiastres: z.number().int().min(0).default(0),
  tollPiastres: z.number().int().min(0).default(0),
  parkingPiastres: z.number().int().min(0).default(0),
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
  if (v.receivedPiastres !== undefined && v.receivedPiastres !== null && v.receivedPiastres > v.grossPiastres) {
    ctx.addIssue({ code: 'custom', path: ['receivedPiastres'], message: 'received cannot exceed gross' });
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
