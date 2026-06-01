import { Injectable } from '@nestjs/common';
import { BaseParser } from './base.parser';
import { OcrParsedTripDto, OcrPlatform } from '../dto/ocr.dto';
import { SemanticNormalizer } from '../semantic/normalizer';

@Injectable()
export class CareemParser extends BaseParser {
  readonly platform: OcrPlatform = 'CAREEM';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }

  /**
   * Careem layout: each location line is preceded by a "HH:MM AM/PM" line.
   * Map view has both pickup-time + dropoff-time pairs; the detail view often
   * shows only the dropoff time + destination at the top. We override the
   * default address-line heuristic to use that ordering.
   */
  protected override extractPickupDestination(
    lines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    const timeRx = /^\d{1,2}:\d{2}\s*(AM|PM|am|pm|ص|م)?$/;
    const pairs: string[] = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (timeRx.test(lines[i].trim())) {
        const next = (lines[i + 1] ?? '').trim();
        if (next && !timeRx.test(next) && next.length > 2 && next.length < 80) {
          // Skip lines that look like section headers / labels.
          if (/^(?:دخلي|الاجره|المسافه|المده|استلمت|دفعت|طريقه)/.test(next)) continue;
          pairs.push(next);
        }
      }
    }
    if (pairs.length >= 2) {
      fields.pickup = pairs[0];
      fields.destination = pairs[1];
      perField.pickup = 0.85;
      perField.destination = 0.85;
      return;
    }
    if (pairs.length === 1) {
      // Single timestamp at the top is the trip-end time → its line is the destination.
      fields.destination = pairs[0];
      perField.destination = 0.7;
      return;
    }
    // Fallback to the generic address-line heuristic.
    super.extractPickupDestination(lines, fields, perField);
  }
}
