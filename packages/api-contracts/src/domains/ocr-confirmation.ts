import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { CreateTripSchema } from './trip-ocr'
import { TripPaymentMethod, tripRecordIntegerSchema } from './trip-details'

export interface OcrConfirmationTrip {
  vehicleId: string; driverAppId: string; areaId?: string | null;
  startedAt: string; endedAt: string; grossPiastres: number | null; commissionPiastres: number | null;
  earningsPiastres?: number | null;
  receivedPiastres?: number | null; tipPiastres: number; tollPiastres: number; parkingPiastres: number;
  totalKmMeters: number; paidKmMeters: number; notes?: string | null;
  pickup?: string | null; destination?: string | null; paymentMethod?: TripPaymentMethod; waitingFeePiastres?: number | null;
}
export interface OcrConfirmationItem { candidateId: string; trip: OcrConfirmationTrip }
export interface OcrConfirmationRequest { items: OcrConfirmationItem[] }
export interface OcrConfirmationReceipt { candidateId: string; tripId: string; savedAt: string; deleted: boolean }
export interface OcrConfirmationFailure { candidateId: string; code: string }
export interface OcrConfirmationResponse { saved: OcrConfirmationReceipt[]; failed: OcrConfirmationFailure[] }

export const ocrConfirmationTripSchema = CreateTripSchema.innerType().omit({ clientMutationId: true }).extend({
  startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }),
  commissionPiastres: tripRecordIntegerSchema.nullable(),
}).superRefine((trip, ctx) => {
  const parsed = CreateTripSchema.safeParse(trip)
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue(issue)
  if (trip.receivedPiastres != null && trip.grossPiastres != null && trip.commissionPiastres != null && trip.grossPiastres - trip.commissionPiastres !== trip.receivedPiastres) {
    ctx.addIssue({ code: 'custom', path: ['receivedPiastres'], message: 'OCR_FINANCIAL_CONFLICT' })
  }
})
export const ocrConfirmationRequestSchema = z.object({
  items: z.array(z.object({ candidateId: z.string().regex(/^[a-f0-9]{64}$/), trip: ocrConfirmationTripSchema }).strict()).min(1).max(20),
}).strict().superRefine((request, ctx) => {
  if (new Set(request.items.map((item) => item.candidateId)).size !== request.items.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate candidate in confirmation' })
  }
})
export const ocrConfirmationReceiptSchema: z.ZodType<OcrConfirmationReceipt> = z.object({
  candidateId: z.string().regex(/^[a-f0-9]{64}$/), tripId: z.string(), savedAt: z.string().datetime(), deleted: z.boolean(),
}).passthrough()
export const ocrConfirmationResponseSchema: z.ZodType<OcrConfirmationResponse> = z.object({
  saved: z.array(ocrConfirmationReceiptSchema), failed: z.array(z.object({ candidateId: z.string(), code: z.string() }).passthrough()),
}).passthrough()

registerOperation({ operationId: 'driver.ocr.imports.confirm', transport: 'http', realm: 'driver', lifecycle: 'active',
  method: 'POST', path: '/api/v1/ocr/imports/:id/confirm', request: { body: 'ocrConfirmationRequestSchema' }, successData: 'ocrConfirmationResponseSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'VALIDATION_ERROR', 'OCR_IMPORT_CLOSED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null,
})
