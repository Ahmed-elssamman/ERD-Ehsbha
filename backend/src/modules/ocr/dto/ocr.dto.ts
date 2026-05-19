import { z } from 'zod';

export const OcrPlatformSchema = z.enum(['UBER', 'INDRIVE', 'DIDI', 'CAREEM']);
export type OcrPlatform = z.infer<typeof OcrPlatformSchema>;

export const OcrPaymentMethodSchema = z.enum(['cash', 'card', 'wallet', 'unknown']);
export type OcrPaymentMethod = z.infer<typeof OcrPaymentMethodSchema>;

export const OcrParsedTripSchema = z.object({
  vehicleType: z.string().nullable(),
  appHint: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  grossEgp: z.number().nullable(),
  receivedEgp: z.number().nullable(),
  tipEgp: z.number().nullable(),
  commissionEgp: z.number().nullable(),
  tollEgp: z.number().nullable(),
  parkingEgp: z.number().nullable(),
  waitingFeeEgp: z.number().nullable(),
  totalKm: z.number().nullable(),
  paidKm: z.number().nullable(),
  pickup: z.string().nullable(),
  destination: z.string().nullable(),
  paymentMethod: OcrPaymentMethodSchema.default('unknown'),
  notes: z.string().nullable(),
});
export type OcrParsedTripDto = z.infer<typeof OcrParsedTripSchema>;

export const OcrExtractResponseSchema = z.object({
  platform: OcrPlatformSchema.nullable(),
  platformConfidence: z.number().min(0).max(1),
  parsed: OcrParsedTripSchema,
  fieldConfidences: z.record(z.string(), z.number().min(0).max(1)),
  warnings: z.array(z.string()),
  imageHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  rawTextLengths: z.array(z.number().int()),
  ocrMeanConfidence: z.number().min(0).max(1),
});
export type OcrExtractResponseDto = z.infer<typeof OcrExtractResponseSchema>;

export const EMPTY_PARSED: OcrParsedTripDto = {
  vehicleType: null,
  appHint: null,
  startedAt: null,
  endedAt: null,
  durationSec: null,
  grossEgp: null,
  receivedEgp: null,
  tipEgp: null,
  commissionEgp: null,
  tollEgp: null,
  parkingEgp: null,
  waitingFeeEgp: null,
  totalKm: null,
  paidKm: null,
  pickup: null,
  destination: null,
  paymentMethod: 'unknown',
  notes: null,
};
