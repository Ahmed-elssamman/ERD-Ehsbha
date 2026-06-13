import {
  ocrExtractResponseSchema,
  type OcrExtractMode,
  type OcrExtractResponse,
  type OcrParsedTrip,
  type OcrPaymentMethod,
  type OcrPlatform,
  type OcrTripResult,
} from '@ehsbha/api-contracts';
import { parseData } from '../../features/platform-api';
import { api } from './client';

export type OcrParsedTripDto = OcrParsedTrip;
export type OcrTripResultDto = OcrTripResult;
export type OcrExtractResponseDto = OcrExtractResponse;
export type { OcrExtractMode, OcrPaymentMethod, OcrPlatform };

export interface OcrExtractInput {
  files: File[];
  mode: OcrExtractMode;
  platform: OcrPlatform;
}

export const OcrApi = {
  async extract(input: OcrExtractInput): Promise<OcrExtractResponseDto> {
    const formData = new FormData();
    for (const file of input.files) formData.append('images', file, file.name);
    formData.append('mode', input.mode);
    formData.append('platform', input.platform);

    const response = await api.post('/ocr/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });

    return parseData(ocrExtractResponseSchema, response.data, 'driver.ocr.extract');
  },
};
