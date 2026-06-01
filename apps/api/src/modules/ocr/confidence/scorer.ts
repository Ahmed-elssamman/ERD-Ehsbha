import { Injectable } from '@nestjs/common';

const REQUIRED_FIELDS = ['grossEgp', 'totalKm', 'startedAt', 'endedAt'] as const;

@Injectable()
export class ConfidenceScorer {
  score(
    perField: Record<string, number>,
    platformConfidence: number,
    ocrMean: number,
  ): { final: Record<string, number>; warnings: string[] } {
    const ocrW = 0.5 + 0.5 * Math.max(0, Math.min(1, ocrMean));
    const platW = 0.7 + 0.3 * Math.max(0, Math.min(1, platformConfidence));
    const final: Record<string, number> = {};
    for (const [field, base] of Object.entries(perField)) {
      const clamped = Math.max(0, Math.min(1, base * ocrW * platW));
      final[field] = Number(clamped.toFixed(3));
    }
    const warnings: string[] = [];
    for (const req of REQUIRED_FIELDS) {
      if ((final[req] ?? 0) < 0.7) warnings.push(`OCR_LOW_CONFIDENCE_${req}`);
    }
    return { final, warnings };
  }
}
