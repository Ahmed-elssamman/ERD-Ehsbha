import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE, tripSchema as sharedTripSchema } from '@ehsbha/api-contracts';

// Shared response contract (passthrough) — re-exported for consumers
export { sharedTripSchema as TripResponseSchema };

// --- Local request schemas (API-specific fields not yet in shared contracts) ---

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

/**
 * Bulk create. Up to 20 trips in one request — sized so a driver who
 * scans an Uber "ملخص الدخل" with 10-15 cards still fits in one round-trip,
 * but small enough that any single failure surface stays digestible.
 *
 * IMPORTANT: items are validated PER-ITEM inside the service, NOT here. If we
 * ran `z.array(CreateTripSchema)` at the controller boundary, a single invalid
 * card (e.g. OCR noise producing paidKm > totalKm, or received > gross) would
 * reject the ENTIRE batch with a 400 — defeating the whole point of the
 * endpoint, which is to save the good cards and report the bad ones per-index.
 * So here we only validate the envelope shape (array, 1..20); each element is
 * `CreateTripSchema.safeParse`d in `TripsService.createBatch`.
 *
 * The server processes each item sequentially (NOT in parallel) so the
 * downstream aggregate-counter upserts don't race on the same
 * driver/day/app row.
 */
export const BatchCreateTripsSchema = z.object({
  items: z.array(z.unknown()).min(1).max(20),
});
export type BatchCreateTripsDto = z.infer<typeof BatchCreateTripsSchema>;

export const BatchDeleteTripsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});
export type BatchDeleteTripsDto = z.infer<typeof BatchDeleteTripsSchema>;

/** @see {@link CursorQuerySchema} from `@ehsbha/api-contracts` for pagination shape (cursor, limit). */
export const ListTripsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  appId: z.string().optional(),
  areaId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListTripsDto = z.infer<typeof ListTripsSchema>;
