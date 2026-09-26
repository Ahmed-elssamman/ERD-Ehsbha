import { OcrStructuredPlatform, type OcrPlatform } from '@ehsbha/api-contracts';

export const GEMINI_PLATFORM_MAP: Record<OcrStructuredPlatform, OcrPlatform | null> = {
  [OcrStructuredPlatform.Uber]: 'UBER',
  [OcrStructuredPlatform.Careem]: 'CAREEM',
  [OcrStructuredPlatform.Indrive]: 'INDRIVE',
  [OcrStructuredPlatform.Didi]: 'DIDI',
  [OcrStructuredPlatform.Other]: null,
};
