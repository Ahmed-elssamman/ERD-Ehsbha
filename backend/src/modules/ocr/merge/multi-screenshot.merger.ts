import { Injectable } from '@nestjs/common';
import { EMPTY_PARSED, OcrParsedTripDto, OcrPaymentMethod } from '../dto/ocr.dto';
import { RawParsed } from '../parsers/base.parser';

const NUMERIC_FIELDS: Array<keyof OcrParsedTripDto> = [
  'grossEgp', 'receivedEgp', 'tipEgp', 'commissionEgp', 'tollEgp', 'parkingEgp', 'waitingFeeEgp',
  'totalKm', 'paidKm', 'durationSec',
];

const STRING_FIELDS: Array<keyof OcrParsedTripDto> = [
  'pickup', 'destination', 'vehicleType', 'appHint',
];

export interface MergedParsed {
  parsed: OcrParsedTripDto;
  perField: Record<string, number>;
  warnings: string[];
}

@Injectable()
export class MultiScreenshotMerger {
  merge(parsed: RawParsed[]): MergedParsed {
    if (parsed.length === 0) {
      return { parsed: { ...EMPTY_PARSED }, perField: {}, warnings: [] };
    }
    if (parsed.length === 1) {
      return {
        parsed: { ...EMPTY_PARSED, ...parsed[0].fields },
        perField: parsed[0].perField as Record<string, number>,
        warnings: [...parsed[0].warnings],
      };
    }

    const out: OcrParsedTripDto = { ...EMPTY_PARSED };
    const outConf: Record<string, number> = {};
    const warnings: string[] = [];

    for (const p of parsed) warnings.push(...p.warnings);

    for (const f of NUMERIC_FIELDS) {
      const candidates = parsed
        .map((p) => ({ value: p.fields[f] as number | undefined, conf: (p.perField as Record<string, number>)[f] ?? 0 }))
        .filter((c) => c.value != null && Number.isFinite(c.value as number));
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => b.conf - a.conf);
      const top = candidates[0];
      const second = candidates[1];
      let value = top.value as number;
      let conf = top.conf;
      if (second && top.value != null && second.value != null) {
        const diff = Math.abs((top.value as number) - (second.value as number));
        const base = Math.max(Math.abs(top.value as number), 1);
        if (diff / base <= 0.02) {
          conf = Math.min(1, conf + 0.15);
        } else if (diff / base > 0.1) {
          warnings.push(`OCR_VALUE_CONFLICT_${f}`);
        }
      }
      (out as Record<string, unknown>)[f] = value;
      outConf[f] = conf;
    }

    for (const f of STRING_FIELDS) {
      const candidates = parsed
        .map((p) => ({ value: p.fields[f] as string | undefined, conf: (p.perField as Record<string, number>)[f] ?? 0 }))
        .filter((c) => typeof c.value === 'string' && (c.value as string).trim().length > 0);
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => b.conf - a.conf || (b.value!.length - a.value!.length));
      (out as Record<string, unknown>)[f] = candidates[0].value;
      outConf[f] = candidates[0].conf;
    }

    let startedAt: string | null = null;
    let startedConf = 0;
    let endedAt: string | null = null;
    let endedConf = 0;
    for (const p of parsed) {
      const s = p.fields.startedAt as string | undefined;
      if (s) {
        if (!startedAt || new Date(s) < new Date(startedAt)) {
          startedAt = s;
          startedConf = Math.max(startedConf, (p.perField as Record<string, number>).startedAt ?? 0.6);
        }
      }
      const e = p.fields.endedAt as string | undefined;
      if (e) {
        if (!endedAt || new Date(e) > new Date(endedAt)) {
          endedAt = e;
          endedConf = Math.max(endedConf, (p.perField as Record<string, number>).endedAt ?? 0.6);
        }
      }
    }
    if (startedAt) { out.startedAt = startedAt; outConf.startedAt = startedConf; }
    if (endedAt) { out.endedAt = endedAt; outConf.endedAt = endedConf; }

    const counts: Record<OcrPaymentMethod, number> = { cash: 0, card: 0, wallet: 0, unknown: 0 };
    for (const p of parsed) {
      const pm = (p.fields.paymentMethod ?? 'unknown') as OcrPaymentMethod;
      counts[pm] += 1;
    }
    let topPm: OcrPaymentMethod = 'unknown';
    let topCount = 0;
    let tie = false;
    for (const [k, v] of Object.entries(counts) as Array<[OcrPaymentMethod, number]>) {
      if (k === 'unknown') continue;
      if (v > topCount) { topPm = k; topCount = v; tie = false; }
      else if (v === topCount && v > 0) { tie = true; }
    }
    out.paymentMethod = tie ? 'unknown' : topPm;
    if (topCount > 0 && !tie) outConf.paymentMethod = 0.7;

    const notes = parsed.map((p) => p.fields.notes).filter((n) => typeof n === 'string' && n!.trim().length > 0) as string[];
    if (notes.length > 0) {
      out.notes = Array.from(new Set(notes)).join('\n');
    }

    return { parsed: out, perField: outConf, warnings: Array.from(new Set(warnings)) };
  }
}
