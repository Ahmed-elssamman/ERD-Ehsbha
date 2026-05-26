import type { AzureLine, AzureReadResult } from '../azure/types';

// HH:MM at the start of a line, optionally followed by 1-4 chars of status-bar
// noise (icon glyph that OCR returns as "x", "®", "©", etc.). Does NOT match
// legitimate AM/PM time lines — those are kept for the date/time extractor.
const STATUS_CLOCK_RX =
  /^\s*\d{1,2}:\d{2}(?:\s+(?!PM\b|AM\b|pm\b|am\b|م\b|ص\b)\S{0,4})?\s*$/;
const STATUS_ICON_RX = /(?:KB\/?S|VoD?\s*LTE|VoLTE|G\/?\d{1,2}|\d{1,3}\s*%|wifi)/i;

const BOTTOM_NAV_VOCAB = [
  'القائمه', 'القائمة',
  'صندوق الوارد', 'صندوق وارد',
  'الأرباح', 'الارباح',
  'الصفحة الرئيسية', 'الصفحه الرئيسيه',
  'الدعم',
  'الإيصال', 'الايصال',
  'home', 'inbox', 'earnings', 'menu', 'support',
];

/**
 * Drops phone-chrome lines from an Azure OCR result so downstream parsers
 * never see the system status bar (HH:MM clock + cellular/wifi/battery icons)
 * or the app's bottom navigation row.
 *
 * Why it matters:
 *  - Without filtering, the status-bar clock "11:17" matches the parser's
 *    `^HH:MM$` duration fallback → durationSec=40620 instead of the real
 *    trip duration; it also gets picked up as the trip start time.
 *  - Bottom-nav Arabic words ("الأرباح", "القائمة", …) leak into pickup /
 *    destination heuristics that look for the first Arabic line near the
 *    pickup pin.
 *
 * The filter is intentionally conservative — only lines that are
 * unambiguously chrome get dropped:
 *  - Top 15% of image AND (matches HH:MM-only OR contains status-bar icon
 *    glyphs like "KB/S", "VoLTE", "72%").
 *  - Bottom 12% of image AND text matches a known nav-vocab term.
 *
 * Image dimensions come from Azure's `metadata.{width,height}` — when they
 * aren't present (older API versions), the filter falls back to dropping
 * only obvious clock-only / icon-only lines regardless of position.
 */
export function filterChromeLines(read: AzureReadResult): AzureReadResult {
  const h = read.imageHeight ?? 0;
  const topCutoff = h > 0 ? h * 0.15 : Number.POSITIVE_INFINITY;
  const bottomCutoff = h > 0 ? h * 0.88 : Number.NEGATIVE_INFINITY;

  const kept: AzureLine[] = [];
  for (const line of read.lines) {
    const text = line.text.trim();
    const inTop = h > 0 ? line.bbox.y + line.bbox.h < topCutoff : true;
    const inBottom = h > 0 ? line.bbox.y > bottomCutoff : false;

    if (inTop && STATUS_CLOCK_RX.test(text)) continue;
    if (inTop && STATUS_ICON_RX.test(text)) continue;
    if (h === 0 && (STATUS_CLOCK_RX.test(text) || STATUS_ICON_RX.test(text))) continue;

    if (inBottom) {
      const lower = text.toLowerCase();
      const isNavTerm = BOTTOM_NAV_VOCAB.some((term) => lower.includes(term.toLowerCase()));
      if (isNavTerm && text.length <= 25) continue;
    }

    kept.push(line);
  }

  const text = kept.map((l) => l.text).join('\n');
  let total = 0;
  let count = 0;
  for (const l of kept) {
    for (const w of l.words) {
      total += w.confidence;
      count += 1;
    }
  }
  const meanConfidence = count > 0 ? total / count : 0;

  return {
    ...read,
    lines: kept,
    text,
    meanConfidence,
  };
}
