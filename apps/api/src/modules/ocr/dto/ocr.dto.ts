import {
  ocrExtractModeSchema,
  ocrExtractRequestHintsSchema,
  ocrExtractResponseSchema,
  ocrParsedTripSchema,
  ocrPaymentMethodSchema,
  ocrPlatformSchema,
  ocrTripResultSchema,
  type OcrExtractMode,
  type OcrExtractRequestHints,
  type OcrExtractResponse,
  type OcrParsedTrip,
  type OcrPaymentMethod,
  type OcrPlatform,
  type OcrTripResult,
} from '@ehsbha/api-contracts';

export const OcrPlatformSchema = ocrPlatformSchema;
export const OcrPaymentMethodSchema = ocrPaymentMethodSchema;
export const OcrParsedTripSchema = ocrParsedTripSchema;
export const OcrExtractModeSchema = ocrExtractModeSchema;
export const OcrExtractRequestHintsSchema = ocrExtractRequestHintsSchema;
export const OcrTripResultSchema = ocrTripResultSchema;
export const OcrExtractResponseSchema = ocrExtractResponseSchema;

export type {
  OcrExtractMode,
  OcrExtractRequestHints,
  OcrPaymentMethod,
  OcrPlatform,
};
export type OcrParsedTripDto = OcrParsedTrip;
export type OcrTripResultDto = OcrTripResult;
export type OcrExtractResponseDto = OcrExtractResponse;

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
