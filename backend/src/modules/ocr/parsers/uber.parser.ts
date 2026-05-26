import { Injectable } from '@nestjs/common';
import { BaseParser, RawParsed } from './base.parser';
import { OcrPlatform, OcrParsedTripDto } from '../dto/ocr.dto';
import { OcrWord, ParseContext } from '../types';
import { SemanticNormalizer } from '../semantic/normalizer';
import { findFieldsOnLine } from '../semantic/dictionary';

// Captures the three OCR scrambling patterns we see for Uber's
// Google-sourced address lines:
//   "<arabic> EG"            ← original visual order
//   "EG <arabic>"            ← RTL flipped: EG at the start, no postal
//   "<digit-postal> EG <arabic>" ← RTL flipped with postal
const PICKUP_EG_REORDER_RX = /^(\d{4,7})\s+EG\s+(.+)$/;
const PICKUP_EG_LEADING_RX = /^EG\s+(.+)$/;

@Injectable()
export class UberParser extends BaseParser {
  readonly platform: OcrPlatform = 'UBER';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }

  override parse(text: string, words: OcrWord[], ctx?: Partial<ParseContext>): RawParsed {
    const res = super.parse(text, words, ctx);

    // Re-order RTL-scrambled address lines so the human-readable form stores
    // the script in the original visual order ("<Arabic> [postal] EG").
    this.reorderAddresses(res.fields);
    this.stitchAddressContinuations(text, res);

    // Fallback derivation: when Azure misreads the income label (e.g.
    // "الدخل" → "لدخل" with the alif dropped) the dictionary pattern
    // doesn't fire and receivedEgp stays null. For Uber the income is
    // mathematically derivable from grossEgp − commissionEgp, so fill it
    // in with low confidence rather than leaving the user empty-handed.
    if (
      res.fields.receivedEgp == null &&
      res.fields.grossEgp != null &&
      res.fields.commissionEgp != null
    ) {
      const derived = Number((res.fields.grossEgp - res.fields.commissionEgp).toFixed(2));
      if (derived > 0) {
        res.fields.receivedEgp = derived;
        res.perField.receivedEgp = 0.7;
        res.warnings.push('OCR_RECEIVED_DERIVED_FROM_GROSS_MINUS_COMMISSION');
      }
    }

    return res;
  }

  private reorderAddresses(fields: Partial<OcrParsedTripDto>): void {
    for (const f of ['pickup', 'destination'] as const) {
      const v = fields[f];
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      const m1 = trimmed.match(PICKUP_EG_REORDER_RX);
      if (m1) {
        fields[f] = `${m1[2].trim()} ${m1[1]} EG`;
        continue;
      }
      const m2 = trimmed.match(PICKUP_EG_LEADING_RX);
      if (m2) {
        fields[f] = `${m2[1].trim()} EG`;
      }
    }
  }

  /**
   * Some Uber screenshots wrap a long pickup or destination across two OCR
   * lines, with the tail (e.g. "فهمي") emitted as its own short Arabic line
   * a few entries below the EG-suffixed line. Detect that pattern and
   * append the tail so we don't lose the last word of the address.
   */
  private stitchAddressContinuations(text: string, res: RawParsed): void {
    const lines = text.split('\n').map((l) => l.trim());
    const stitch = (field: 'pickup' | 'destination'): void => {
      const v = res.fields[field];
      if (typeof v !== 'string') return;
      // Anchor on the postal+EG suffix from the field value — this uniquely
      // identifies the source OCR line even when both pickup and destination
      // share the same Arabic head (e.g. both "مدينة نصر…"). Without this,
      // a destination's continuation would accidentally be sourced from the
      // pickup's neighborhood.
      const postalMatch = v.match(/(\d{4,7})\s+EG\b/) ?? v.match(/\bEG\b/);
      if (!postalMatch) return;
      const anchor = postalMatch[1] ? `${postalMatch[1]} EG` : 'EG';
      const lineIdx = lines.findIndex((l) => l.includes(anchor));
      if (lineIdx < 0) return;
      // Look at the next 1-3 lines for a short Arabic-only continuation
      // word/phrase (no digits, no Latin letters, ≤ 8 chars).
      for (let j = lineIdx + 1; j < Math.min(lineIdx + 4, lines.length); j++) {
        const next = lines[j];
        if (!next) continue;
        // Reject lines with any digit — Latin (\d) OR Arabic-Indic (٠-٩).
        // Without the Arabic-Indic check, OCR noise like "٠١٠٠٠٠" gets
        // mistakenly stitched into the pickup as if it were a name suffix.
        if (/[\d٠-٩]/.test(next)) continue;
        if (/[A-Za-z]{2,}/.test(next)) continue;
        if (!/^[؀-ۿ\s]{2,8}$/.test(next)) continue;
        // Skip lines that are themselves dictionary labels (section
        // headers like "الدخل", "الأجرة", "المدة" etc. — appending these
        // to an address would corrupt it).
        const nextNorm = this.normalizer.normalizeText(next);
        if (findFieldsOnLine(nextNorm).length > 0) continue;
        // Fold the Persian ی → Arabic ي (Azure sometimes emits the Persian
        // glyph for the same letter shape).
        const tail = next.replace(/ی/g, 'ي').replace(/ک/g, 'ك');
        // Already part of the value?
        if (v.includes(tail) || v.includes(next)) return;
        // Insert the tail BEFORE the postal+EG suffix so the visual order
        // matches the source ("…محمد علي فهمي 4442441 EG"), not appended
        // after EG.
        const suffixMatch = v.match(/(\s+\d{4,7}\s+EG)\s*$/) ?? v.match(/(\s+EG)\s*$/);
        if (suffixMatch) {
          const head = v.slice(0, v.length - suffixMatch[0].length).trimEnd();
          res.fields[field] = `${head} ${tail}${suffixMatch[0]}`;
        } else {
          res.fields[field] = `${v} ${tail}`;
        }
        return;
      }
    };
    stitch('pickup');
    stitch('destination');
  }
}
