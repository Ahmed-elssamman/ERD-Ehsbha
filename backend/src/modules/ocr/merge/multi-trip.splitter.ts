import { Injectable, Logger } from '@nestjs/common';
import { OcrLine, OcrResult } from '../types';

// Matches the per-card time stamp on Uber's "ملخص الدخل" summary screen.
// Real-world Azure output for these times looks like:
//   - "₱ 5:32"   ← OCR's interpretation of the "الإيصال" pin icon + time
//   - "~ 5:49"   ← different pin glyph, same idea
//   - "5:32 م"   ← rare clean variant when the icon doesn't render
//   - "10:46 PM" ← English-language device locale
// We accept any of: required AM/PM/م/ص suffix OR a 1-3 non-digit non-space
// glyph prefix. That ordering guards against matching the status-bar clock
// "11:16" (no prefix, no suffix) — even though chrome-filter already drops
// it, defense in depth.
const CARD_TIME_RX =
  /^(?:[^\d\s]{1,3}\s+\d{1,2}:\d{2}(?:\s*(?:م|ص|AM|PM|am|pm))?|\d{1,2}:\d{2}\s*(?:م|ص|AM|PM|am|pm))\s*$/;

// Each card's amount line ("19.70 ج.م.", ".P.@ 19.70", "27.04 ج.م.") sits
// EXACTLY 2 lines above the time line (with the icon "00" filling the gap).
// We slice from `time_idx - LOOKBACK` so the per-card parser sees the
// prominent income value. A larger lookback would (a) bleed in the previous
// card's destination line and (b) accidentally pull the optional surge banner
// "زادت قيمة الأجرة" into the slice — that banner matches the fare
// dictionary entry and steals the amount for grossEgp.
const LOOKBACK_FROM_TIME = 2;

export interface TripSlice {
  /** Sequential 1-based card index in the summary screen. */
  index: number;
  text: string;
  lines: OcrLine[];
}

/**
 * Splits a single OCR result (the entirety of a multi-trip summary screen)
 * into per-card slices. Each card on Uber's "ملخص الدخل" screen starts with
 * a time marker on its own line ("5:49 م", "6:56 PM", …); everything from
 * one time line to the next belongs to the same trip card.
 *
 * The output preserves the original OcrLine[] (with bounding boxes and
 * confidence) for each slice, so existing parsers can run unchanged on
 * each one.
 */
@Injectable()
export class MultiTripSplitter {
  private readonly logger = new Logger(MultiTripSplitter.name);

  split(read: OcrResult): TripSlice[] {
    const timeIdxs: number[] = [];
    for (let i = 0; i < read.lines.length; i++) {
      if (CARD_TIME_RX.test(read.lines[i].text.trim())) {
        timeIdxs.push(i);
      }
    }

    if (timeIdxs.length === 0) {
      // Couldn't find any card markers. Fall back to treating the whole
      // image as a single trip — callers can decide how to handle this.
      this.logger.warn('No per-card time markers found; returning single slice');
      return [
        {
          index: 1,
          text: read.text,
          lines: read.lines,
        },
      ];
    }

    const slices: TripSlice[] = [];
    let prevEnd = 0;
    for (let c = 0; c < timeIdxs.length; c++) {
      const cardStart = Math.max(prevEnd, timeIdxs[c] - LOOKBACK_FROM_TIME);
      const cardEnd =
        c + 1 < timeIdxs.length
          ? Math.max(cardStart, timeIdxs[c + 1] - LOOKBACK_FROM_TIME)
          : read.lines.length;
      const lines = read.lines.slice(cardStart, cardEnd);
      const text = lines.map((l) => l.text).join('\n');
      slices.push({ index: c + 1, text, lines });
      prevEnd = cardEnd;
    }
    return slices;
  }
}
