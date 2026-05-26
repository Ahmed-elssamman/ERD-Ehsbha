import { Injectable } from '@nestjs/common';
import { BaseParser, RawParsed } from './base.parser';
import { OcrPlatform } from '../dto/ocr.dto';
import { OcrWord, ParseContext } from '../types';
import { SemanticNormalizer } from '../semantic/normalizer';
import { normalizeNumeric } from '../semantic/digit-normalizer';

// Anchors the address block. We only require the date portion (YYYY/MM/DD)
// because Azure occasionally emits the scrambled RTL order
// "08:09.2026/05/16 م" (time before date) when the source was
// "2026/05/16، 08:09 م" — but a 4-digit-year date is still a reliable
// landmark.
const DIDI_DATETIME_LINE_RX = /\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}/;
const ADDRESS_NOISE_PREFIX_RX = /^[●•∙•●◦*\-_\s]+/;

/**
 * DiDi trip-details parser.
 *
 * The base parser's left-to-right dictionary scan fights the actual DiDi
 * layout, which prints values ABOVE their labels in the rider-payment
 * section and TWICE for `أجرة المشوار` (once in the driver's earnings
 * section, once in the rider's payment section). This subclass therefore
 * runs a second pass after `super.parse()` that:
 *
 *   1. Splits the OCR text into the three canonical sections:
 *        - driver earnings   ("أرباحك")
 *        - rider payment     ("دفع الراكب")
 *        - DiDi receivables  ("مستحقات دي دي")
 *   2. For each label of interest, finds the nearest unassigned currency
 *      value within the same section (±2 lines), preferring the closest
 *      candidate. A line is considered a "value line" only if it contains
 *      a currency amount.
 *   3. Re-assigns `grossEgp` (rider-side أجرة), `receivedEgp` (المدفوع من
 *      الراكب), `waitingFeeEgp` (driver's waiting-time fee), and
 *      `commissionEgp` (مستحقات دي دي service fee inc. VAT).
 *   4. Extracts pickup + destination from the address block below the
 *      "تفاصيل المشوار" datestamp.
 *
 * Brand-name vehicle tier ("Tayaran", DiDi's standard sedan tier) is left
 * for the base parser's vehicle map.
 */
@Injectable()
export class DidiParser extends BaseParser {
  readonly platform: OcrPlatform = 'DIDI';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }

  override parse(text: string, words: OcrWord[], ctx?: Partial<ParseContext>): RawParsed {
    const res = super.parse(text, words, ctx);
    this.fixDidiAmounts(text, res);
    this.extractPickupDestinationDidi(text, res);
    this.maybeExtractVehicleTier(text, res);
    return res;
  }

  private fixDidiAmounts(text: string, res: RawParsed): void {
    const lines = text.split('\n').map((l) => l.trim());
    const normLines = lines.map((l) => this.normalizer.normalizeText(l));

    // Section boundaries.
    let riderStart = -1;
    let commissionStart = -1;
    for (let i = 0; i < normLines.length; i++) {
      if (riderStart === -1 && /^دفع\s*الراكب/.test(normLines[i])) {
        riderStart = i;
      } else if (riderStart >= 0 && commissionStart === -1 && /مستحقات/.test(normLines[i])) {
        commissionStart = i;
      }
    }
    const riderEnd = commissionStart >= 0 ? commissionStart : lines.length;
    const driverEnd = riderStart >= 0 ? riderStart : lines.length;

    const isLabelLine = (i: number): boolean => {
      if (i < 0 || i >= lines.length) return false;
      if (this.findCurrencyOnLine(lines[i])) return false;
      return /[؀-ۿ]{2,}/.test(normLines[i]);
    };

    const findNearestValue = (
      labelIdx: number,
      sectionStart: number,
      sectionEnd: number,
      opts: { minValue?: number; maxValue?: number; allowNegative?: boolean } = {},
    ): { value: number; idx: number } | null => {
      const { minValue = -Infinity, maxValue = Infinity, allowNegative = false } = opts;
      const candidates: Array<{ delta: number; value: number; idx: number }> = [];
      for (const d of [-1, 1, -2, 2]) {
        const j = labelIdx + d;
        if (j < sectionStart || j >= sectionEnd) continue;
        if (isLabelLine(j)) continue;
        const found = this.findCurrencyOnLine(lines[j]);
        if (!found || !Number.isFinite(found.amount)) continue;
        const v = allowNegative ? found.amount : Math.abs(found.amount);
        if (v < minValue || v > maxValue) continue;
        if (!allowNegative && found.amount < 0) continue;
        candidates.push({ delta: Math.abs(d), value: v, idx: j });
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.delta - b.delta);
      return { value: candidates[0].value, idx: candidates[0].idx };
    };

    // Rider section: extract receivedEgp + grossEgp (max of all أجرة matches).
    if (riderStart >= 0) {
      let grossMax: number | null = null;
      let receivedFound: number | null = null;
      for (let i = riderStart; i < riderEnd; i++) {
        if (/^المدفوع\s*من\s*الراكب/.test(normLines[i])) {
          const v = findNearestValue(i, riderStart, riderEnd, { minValue: 0.01 });
          if (v && receivedFound == null) receivedFound = v.value;
        }
        if (/^اجره\s*المشوار(?:$|\s)/.test(normLines[i])) {
          const v = findNearestValue(i, riderStart, riderEnd, { minValue: 0.01 });
          if (v && (grossMax == null || v.value > grossMax)) grossMax = v.value;
        }
      }
      if (receivedFound != null) {
        res.fields.receivedEgp = receivedFound;
        res.perField.receivedEgp = 0.95;
      }
      if (grossMax != null) {
        res.fields.grossEgp = grossMax;
        res.perField.grossEgp = 0.95;
      }
    }

    // Driver section: extract waitingFeeEgp.
    let waitingFound: number | null = null;
    for (let i = 0; i < driverEnd; i++) {
      if (/^رسوم\s*وقت\s*الانتظار/.test(normLines[i])) {
        const v = findNearestValue(i, 0, driverEnd, { minValue: 0.01, maxValue: 50 });
        if (v) waitingFound = v.value;
      }
    }
    if (waitingFound != null) {
      res.fields.waitingFeeEgp = waitingFound;
    } else if (res.fields.waitingFeeEgp != null && res.fields.waitingFeeEgp > 100) {
      // Base parser likely grabbed an unrelated total — clear it.
      res.fields.waitingFeeEgp = undefined;
    }

    // Commission section: prefer "رسوم الخدمة شاملة ضريبة المضافة" value
    // (which equals the total commission). The value is on the line below or
    // above the label. Always store as positive.
    if (commissionStart >= 0) {
      for (let i = commissionStart; i < lines.length; i++) {
        if (/رسوم\s*الخدمه\s*شامله\s*ضريبه/.test(normLines[i])) {
          const v = findNearestValue(i, commissionStart, lines.length, {
            allowNegative: true,
            minValue: -1000,
            maxValue: 1000,
          });
          if (v) {
            res.fields.commissionEgp = Math.abs(v.value);
            res.perField.commissionEgp = 0.95;
            break;
          }
        }
      }
    }
  }

  private extractPickupDestinationDidi(text: string, res: RawParsed): void {
    const lines = text.split('\n').map((l) => l.trim());
    let anchor = -1;
    for (let i = 0; i < lines.length; i++) {
      if (DIDI_DATETIME_LINE_RX.test(normalizeNumeric(lines[i]))) {
        anchor = i;
        break;
      }
    }
    if (anchor < 0) return;

    // Pull at most 6 address-like lines below the timestamp. The bottom of
    // the screen is a map with city/neighbourhood callouts — those callouts
    // tend to be short tokens like "TAJ CITY", "كايرو", which we stop at.
    const after: Array<{ idx: number; text: string }> = [];
    for (let i = anchor + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (/^google$/i.test(l)) break;
      // Map-callout heuristic: short uppercase-only Latin OR very short
      // Arabic. They appear AFTER the actual addresses.
      if (after.length >= 2 && l.length <= 14) break;
      if (l.length < 4) continue;
      after.push({ idx: i, text: l });
      if (after.length >= 6) break;
    }
    if (after.length === 0) return;

    // Group into two address blocks. Heuristic: a block ends at a Latin
    // "Egypt"/"مصر" terminator OR after 2 lines (which covers the typical
    // pickup/destination wrap pattern).
    const blocks: string[] = [];
    let current: string[] = [];
    for (const a of after) {
      current.push(a.text);
      const terminator = /\b(?:Egypt|مصر)\b/i.test(a.text) || current.length >= 2;
      if (terminator) {
        blocks.push(current.join(' ').trim());
        current = [];
        if (blocks.length >= 2) break;
      }
    }
    if (current.length > 0 && blocks.length < 2) blocks.push(current.join(' ').trim());

    // Unconditional overwrite: the base parser's generic address extractor
    // sometimes captures only the second half of a Didi multi-line address
    // (the Latin "Governorate ... Egypt" continuation), so we always prefer
    // the section-aware Didi blocks when they're available.
    //
    // Tidy-up steps:
    //  - Strip OCR-emitted bullet/dot glyphs that prefix the address row
    //    ("● عمارة ...") — they're decorative pin icons in the source UI.
    //  - Collapse duplicate Arabic-or-Latin commas the OCR sometimes
    //    produces at the Arabic→Latin script boundary.
    //  - Translate Arabic-Indic digits to Latin so the stored address
    //    matches the human-readable form ("4145" not "٤١٤٥").
    const tidy = (s: string): string =>
      normalizeNumeric(s)
        .replace(ADDRESS_NOISE_PREFIX_RX, '')
        .replace(/،\s*،/g, '،')
        .replace(/,\s*,/g, ',')
        .trim();
    if (blocks[0]) {
      res.fields.pickup = tidy(blocks[0]);
      res.perField.pickup = 0.85;
    }
    if (blocks[1]) {
      res.fields.destination = tidy(blocks[1]);
      res.perField.destination = 0.85;
    }
  }

  private maybeExtractVehicleTier(text: string, res: RawParsed): void {
    if (res.fields.vehicleType) return;
    // DiDi's Egypt-region default tier shows up verbatim on every screen.
    if (/\btayaran\b/i.test(text)) {
      res.fields.vehicleType = 'Tayaran';
      res.perField.vehicleType = 0.85;
    }
  }
}
