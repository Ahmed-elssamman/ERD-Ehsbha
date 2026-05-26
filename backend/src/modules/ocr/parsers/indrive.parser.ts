import { Injectable } from '@nestjs/common';
import { BaseParser, RawParsed } from './base.parser';
import { OcrPlatform } from '../dto/ocr.dto';
import { OcrWord, ParseContext } from '../types';
import { SemanticNormalizer } from '../semantic/normalizer';

const TIME_RX = /^\s*(\d{1,2}):(\d{2})\s*(PM|AM|pm|am|م|ص)\s*$/;
const DATE_HEADER_RX = /^(?:الجمعه|السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس)/;
const DUR_OR_DIST_HEADER_RX = /^(?:المسافه|المده|الإيصال|الدعم)$/;
const TRIP_BANNER_RX = /^رحل[ةه]/; // "رحلة اكتملت" / "رحله احتملت"

@Injectable()
export class IndriveParser extends BaseParser {
  readonly platform: OcrPlatform = 'INDRIVE';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }

  override parse(text: string, words: OcrWord[], ctx?: Partial<ParseContext>): RawParsed {
    const res = super.parse(text, words, ctx);

    // InDrive shows TWO timestamps on the receipt — the EARLIER one is the
    // trip start, the LATER one is the trip end. The base parser picks the
    // first time it sees (always the prominent end-time header) and assigns
    // it as startedAt, leaving the real start time discarded. Re-derive
    // both from all time matches in the OCR text.
    this.fixStartEndTimes(text, res);

    // Addresses live in the band between the date header and the
    // المسافة/المدة summary row. Their order vs. the time stamps varies by
    // screenshot (sometimes pickup appears before the start time, sometimes
    // after) — a time-anchor heuristic is therefore unreliable. Instead we
    // gather every text line in that band, drop times and chrome, then
    // stitch short Arabic continuation lines into their previous block.
    this.extractPickupDestinationInDrive(text, res);

    if (res.fields.commissionEgp == null) {
      res.fields.commissionEgp = 0;
      res.perField.commissionEgp = 0.4;
      res.warnings.push('OCR_INDRIVE_NO_COMMISSION_LINE');
    }
    return res;
  }

  private collectTimes(lines: string[]): Array<{ idx: number; mins: number; hh: number; mm: number }> {
    const out: Array<{ idx: number; mins: number; hh: number; mm: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(TIME_RX);
      if (!m) continue;
      const h = Number(m[1]);
      const mn = Number(m[2]);
      const suffix = (m[3] ?? '').toLowerCase();
      let hour = h;
      const isPm = suffix === 'pm' || suffix === 'م';
      const isAm = suffix === 'am' || suffix === 'ص';
      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;
      out.push({ idx: i, mins: hour * 60 + mn, hh: hour, mm: mn });
    }
    return out;
  }

  private fixStartEndTimes(text: string, res: RawParsed): void {
    const lines = text.split('\n');
    const times = this.collectTimes(lines);
    if (times.length < 2) return;
    const uniq = Array.from(new Map(times.map((t) => [t.mins, t])).values());
    if (uniq.length < 2) return;
    uniq.sort((a, b) => a.mins - b.mins);
    const start = uniq[0];
    const end = uniq[uniq.length - 1];

    const datePart = res.fields.startedAt
      ? res.fields.startedAt.substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    const startIso = `${datePart}T${String(start.hh).padStart(2, '0')}:${String(start.mm).padStart(2, '0')}:00.000Z`;
    const endIso = `${datePart}T${String(end.hh).padStart(2, '0')}:${String(end.mm).padStart(2, '0')}:00.000Z`;
    res.fields.startedAt = startIso;
    res.fields.endedAt = endIso;
    res.perField.startedAt = 0.92;
    res.perField.endedAt = 0.92;
    res.warnings = res.warnings.filter((w) => w !== 'OCR_TIME_AMBIGUOUS');
  }

  private extractPickupDestinationInDrive(text: string, res: RawParsed): void {
    const lines = text.split('\n').map((l) => l.trim());
    const normLines = lines.map((l) => this.normalizer.normalizeText(l));

    // Start of the address band: line right after the Arabic date header.
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (DATE_HEADER_RX.test(normLines[i])) {
        startIdx = i + 1;
        break;
      }
    }
    // End of the address band: first occurrence of "المسافة" / "المدة" /
    // "الإيصال" / "الدعم" (anything that follows the route summary).
    let endIdx = lines.length;
    for (let i = startIdx; i < lines.length; i++) {
      if (DUR_OR_DIST_HEADER_RX.test(normLines[i])) {
        endIdx = i;
        break;
      }
    }

    const candidates: Array<{ idx: number; text: string }> = [];
    for (let i = startIdx; i < endIdx; i++) {
      const l = lines[i];
      if (!l || l.length < 3) continue;
      if (TIME_RX.test(l)) continue;
      if (TRIP_BANNER_RX.test(normLines[i])) continue;
      // Skip stray icon glyphs that OCR returns as "0", "L", "®", etc.
      if (/^[\W_]{1,3}$/.test(l)) continue;
      candidates.push({ idx: i, text: l });
    }
    if (candidates.length === 0) return;

    // Stitch short Arabic-only continuation lines (e.g., "المصرى" tail of
    // "استاد القاهرة الدولي") onto the previous candidate.
    const merged: Array<{ idx: number; text: string }> = [];
    for (let i = 0; i < candidates.length; i++) {
      let cur = { idx: candidates[i].idx, text: candidates[i].text };
      while (i + 1 < candidates.length) {
        const next = candidates[i + 1];
        const gap = next.idx - cur.idx - cur.text.split('\n').length + 1;
        const nextIsShort = next.text.length <= 12;
        const nextHasArabic = /[؀-ۿ]/.test(next.text);
        const nextHasNoLatinWord = !/[A-Za-z]{3,}/.test(next.text);
        if (gap <= 2 && nextIsShort && nextHasArabic && nextHasNoLatinWord) {
          cur = { idx: cur.idx, text: `${cur.text} ${next.text}` };
          i++;
        } else {
          break;
        }
      }
      merged.push(cur);
    }

    // Unconditional overwrite — the base parser's generic address extractor
    // tends to pick "Dr Ali Hassan 16009" (5-digit postal heuristic) as
    // pickup even when it's actually the destination on InDrive screens.
    if (merged[0]) {
      res.fields.pickup = merged[0].text.trim();
      res.perField.pickup = 0.85;
    }
    if (merged[1]) {
      res.fields.destination = merged[1].text.trim();
      res.perField.destination = 0.85;
    }
  }
}
