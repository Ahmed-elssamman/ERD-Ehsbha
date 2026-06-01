import { Injectable } from '@nestjs/common';
import { OcrParsedTripDto } from '../dto/ocr.dto';

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;
const TWELVE_HOURS_MS = 12 * 3600 * 1000;

@Injectable()
export class TripValidator {
  validate(parsed: OcrParsedTripDto, now: Date = new Date()): string[] {
    const w: string[] = [];

    if (parsed.grossEgp != null) {
      if (parsed.grossEgp < 0 || parsed.grossEgp > 5000) w.push('OCR_OUT_OF_RANGE_fare');
    }
    if (parsed.receivedEgp != null && parsed.grossEgp != null && parsed.grossEgp > 0) {
      if (parsed.receivedEgp > parsed.grossEgp * 1.5) w.push('OCR_OUT_OF_RANGE_received');
    }
    if (parsed.commissionEgp != null && parsed.grossEgp != null && parsed.grossEgp > 0) {
      if (parsed.commissionEgp > parsed.grossEgp * 0.6) w.push('OCR_OUT_OF_RANGE_commission');
    }
    if (parsed.totalKm != null) {
      if (parsed.totalKm < 0 || parsed.totalKm > 500) w.push('OCR_OUT_OF_RANGE_distance');
    }
    if (parsed.paidKm != null && parsed.totalKm != null) {
      if (parsed.paidKm > parsed.totalKm * 1.05) w.push('OCR_OUT_OF_RANGE_paidKm');
    }
    if (parsed.startedAt && parsed.endedAt) {
      const s = new Date(parsed.startedAt).getTime();
      const e = new Date(parsed.endedAt).getTime();
      if (e <= s) w.push('OCR_END_BEFORE_START');
      if (e - s > TWELVE_HOURS_MS) w.push('OCR_DURATION_TOO_LONG');
    }
    if (parsed.durationSec != null && parsed.durationSec > 12 * 3600) {
      w.push('OCR_DURATION_TOO_LONG');
    }
    if (parsed.grossEgp != null && parsed.totalKm != null && parsed.totalKm > 0) {
      const rate = parsed.grossEgp / parsed.totalKm;
      if (rate > 30) w.push('OCR_RATE_PER_KM_HIGH');
      if (rate < 1) w.push('OCR_RATE_PER_KM_LOW');
    }
    if (parsed.startedAt) {
      const s = new Date(parsed.startedAt).getTime();
      if (s > now.getTime()) w.push('OCR_FUTURE_TIMESTAMP');
      if (now.getTime() - s > NINETY_DAYS_MS) w.push('OCR_TIMESTAMP_TOO_OLD');
    }

    return Array.from(new Set(w));
  }
}
