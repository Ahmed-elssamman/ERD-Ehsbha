import { api, unwrap } from './client';

export type OcrPlatform = 'UBER' | 'INDRIVE' | 'DIDI' | 'CAREEM';
export type OcrPaymentMethod = 'cash' | 'card' | 'wallet' | 'unknown';

export interface OcrParsedTripDto {
  vehicleType: string | null;
  appHint: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  grossEgp: number | null;
  receivedEgp: number | null;
  tipEgp: number | null;
  commissionEgp: number | null;
  tollEgp: number | null;
  parkingEgp: number | null;
  waitingFeeEgp: number | null;
  totalKm: number | null;
  paidKm: number | null;
  pickup: string | null;
  destination: string | null;
  paymentMethod: OcrPaymentMethod;
  notes: string | null;
}

export interface OcrExtractResponseDto {
  platform: OcrPlatform | null;
  platformConfidence: number;
  parsed: OcrParsedTripDto;
  fieldConfidences: Record<string, number>;
  warnings: string[];
  imageHashes: string[];
  rawTextLengths: number[];
  ocrMeanConfidence: number;
}

export const OcrApi = {
  async extract(files: File[]): Promise<OcrExtractResponseDto> {
    const fd = new FormData();
    for (const f of files) fd.append('images', f, f.name);
    const r = await api.post('/ocr/extract', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return unwrap<OcrExtractResponseDto>(r.data);
  },
};
