import {
  type OcrExtractMode,
  type OcrExtractResponse,
  type OcrParsedTrip,
  type OcrPaymentMethod,
  type OcrPlatform,
  type OcrTripResult,
} from '@ehsbha/api-contracts';

export type OcrParsedTripDto = OcrParsedTrip;
export type OcrTripResultDto = OcrTripResult;
export type OcrExtractResponseDto = OcrExtractResponse;
export type { OcrExtractMode, OcrPaymentMethod, OcrPlatform };

export interface OcrExtractInput {
  files: File[];
  mode: OcrExtractMode;
  platform: OcrPlatform | null;
}
