import { EMPTY_PARSED, OcrParsedTripDto, OcrPaymentMethod, OcrPlatform } from '../dto/ocr.dto';
import { OcrLine, OcrWord, ParseContext } from '../types';
import { normalizeNumeric, parseAmount, stripBidi } from '../semantic/digit-normalizer';
import { SemanticNormalizer } from '../semantic/normalizer';
import { findFieldsOnLine } from '../semantic/dictionary';

export interface RawParsed {
  fields: Partial<OcrParsedTripDto>;
  perField: Partial<Record<keyof OcrParsedTripDto, number>>;
  warnings: string[];
}

const MONTHS_AR: Record<string, number> = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4,
  'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'اغسطس': 8, 'أغسطس': 8,
  'سبتمبر': 9, 'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};
const MONTHS_EN: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const VEHICLE_MAP: Array<[RegExp, string]> = [
  [/سكوتر|سيكوتر|scooter/i, 'scooter'],
  [/توك\s*توك|tuk[\s-]?tuk/i, 'tuktuk'],
  [/موتسيكل|motorcycle|دراجه\s*ناريه/i, 'motorcycle'],
  [/سياره|\bcar\b/i, 'car'],
  [/دراجه|bike/i, 'bike'],
];

const CURRENCY_RX = /(?:ج\s?\.?\s?م\.?|EGP|EG[£L]|جنيه)/i;
const KM_RX = /(?:كلم|كم|km)/i;

export abstract class BaseParser {
  abstract readonly platform: OcrPlatform;

  constructor(protected readonly normalizer: SemanticNormalizer) {}

  parse(text: string, words: OcrWord[], ctx?: Partial<ParseContext>): RawParsed {
    const fields: Partial<OcrParsedTripDto> = {};
    const perField: Partial<Record<keyof OcrParsedTripDto, number>> = {};
    const warnings: string[] = [];

    const positionalLines: OcrLine[] | undefined = ctx?.lines;
    const lines = positionalLines && positionalLines.length > 0
      ? positionalLines.map((l) => l.text.trim()).filter(Boolean)
      : this.splitLines(text);
    const normalizedLines = lines.map((l) => this.normalizer.normalizeText(l));
    // Fully normalized (letter folding + digit translation) — used by
    // pattern-based extractors so Arabic-Indic digits and ة/ه variants
    // both match the dictionary entries.
    const fullyNormLines = normalizedLines.map((l) => normalizeNumeric(l));

    this.extractAmounts(lines, normalizedLines, fields, perField);
    this.extractDistance(lines, normalizedLines, fields, perField);
    this.extractDuration(fullyNormLines, normalizedLines, fields, perField, warnings);
    const dt = this.extractDateTime(fullyNormLines, normalizedLines);
    if (dt.startedAtIso) { fields.startedAt = dt.startedAtIso; perField.startedAt = dt.confidence; }
    if (dt.endedAtIso) { fields.endedAt = dt.endedAtIso; perField.endedAt = dt.confidence; }
    if (dt.ambiguous) warnings.push('OCR_TIME_AMBIGUOUS');

    this.extractPayment(normalizedLines, fields, perField);
    this.extractWaiting(normalizedLines, fields, perField, warnings);
    this.extractVehicle(text, fields, perField);
    this.extractPickupDestination(lines, fields, perField);
    this.extractPlatformHint(fields);

    this.derivePaidKm(fields, perField, warnings);

    if (!fields.endedAt && fields.startedAt && fields.durationSec) {
      const start = new Date(fields.startedAt);
      const end = new Date(start.getTime() + fields.durationSec * 1000);
      fields.endedAt = end.toISOString();
      perField.endedAt = Math.min(perField.startedAt ?? 0.6, 0.7);
      warnings.push('OCR_DURATION_FROM_TIMESTAMPS');
    }

    if (ctx?.receipt) {
      this.applyReceiptHints(fields, perField, ctx.receipt);
    }

    return { fields, perField, warnings };
  }

  /**
   * Cross-checks parsed regex output against Azure Document Intelligence's
   * prebuilt-receipt fields. DI gives high-precision values for the total /
   * subtotal / transaction-date — when DI's confidence beats the regex
   * parser's confidence for that field, prefer the DI value.
   *
   * DI returns ride-receipt "Total" as what the customer paid → grossEgp.
   * Subtotal (when present) maps to receivedEgp on apps that show both.
   */
  protected applyReceiptHints(
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
    receipt: NonNullable<ParseContext['receipt']>,
  ): void {
    if (!receipt.isReceipt) return;

    const diConf = Math.max(0, Math.min(1, receipt.meanConfidence));
    const beats = (existing: number | undefined, threshold: number): boolean =>
      diConf > (existing ?? 0) + 0.05 && diConf >= threshold;

    if (receipt.total != null && beats(perField.grossEgp, 0.6)) {
      fields.grossEgp = receipt.total;
      perField.grossEgp = Math.max(perField.grossEgp ?? 0, diConf);
    }
    if (receipt.subtotal != null && beats(perField.receivedEgp, 0.6)) {
      fields.receivedEgp = receipt.subtotal;
      perField.receivedEgp = Math.max(perField.receivedEgp ?? 0, diConf);
    }
    if (receipt.tip != null && fields.tipEgp == null) {
      fields.tipEgp = receipt.tip;
      perField.tipEgp = diConf * 0.9;
    }
    if (receipt.transactionDate && receipt.transactionTime && fields.startedAt == null) {
      const iso = `${receipt.transactionDate}T${receipt.transactionTime}.000Z`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        fields.startedAt = d.toISOString();
        perField.startedAt = diConf * 0.85;
      }
    } else if (receipt.transactionDate && fields.startedAt == null) {
      const iso = `${receipt.transactionDate}T00:00:00.000Z`;
      fields.startedAt = iso;
      perField.startedAt = diConf * 0.7;
    }
  }

  protected splitLines(text: string): string[] {
    return stripBidi(text)
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  protected findCurrencyOnLine(line: string): { amount: number; raw: string } | null {
    const norm = normalizeNumeric(line);
    // amount before currency: "27.04 ج.م"
    // The optional `-?` between the digits and the currency unit handles
    // Arabic accounting convention where the minus sign trails the number
    // (e.g. "4.77- ج.م." on Uber's commission line). The minus is purely a
    // sign indicator — we return the magnitude here and let the field
    // assignment decide what sign it actually represents.
    const after = norm.match(new RegExp(`(-?\\d[\\d.,]*)\\s*-?\\s*${CURRENCY_RX.source}`, 'i'));
    if (after) {
      const a = parseAmount(after[1]);
      // Return magnitude — OCR-driven fields (fare, commission, etc.) are
      // always non-negative in our data model. Whether the value represents
      // a deduction or a credit is determined by the matching label, not by
      // the OCR sign convention.
      if (a != null) return { amount: Math.abs(a), raw: after[0] };
    }
    // currency before amount: "EGP 27.04"
    const before = norm.match(new RegExp(`${CURRENCY_RX.source}\\s*(-?\\d[\\d.,]*)`, 'i'));
    if (before) {
      const a = parseAmount(before[1]);
      if (a != null) return { amount: Math.abs(a), raw: before[0] };
    }
    return null;
  }

  protected findKmOnLine(line: string): number | null {
    const norm = normalizeNumeric(line);
    // amount before unit: "5.70 كلم" / "6.7 كم" / "26.6 km"
    const after = norm.match(new RegExp(`(\\d[\\d.,]*)\\s*${KM_RX.source}`, 'i'));
    if (after) {
      const a = parseAmount(after[1]);
      if (a != null) return a;
    }
    // unit before amount (Careem LTR): "km 26,6"
    const before = norm.match(new RegExp(`${KM_RX.source}\\s*(\\d[\\d.,]*)`, 'i'));
    if (before) {
      const a = parseAmount(before[1]);
      if (a != null) return a;
    }
    return null;
  }

  protected extractAmounts(
    lines: string[],
    normalizedLines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    const allAmounts: Array<{ amount: number; lineIdx: number; raw: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const found = this.findCurrencyOnLine(lines[i]);
      if (found) allAmounts.push({ ...found, lineIdx: i });
    }

    for (let i = 0; i < normalizedLines.length; i++) {
      const entries = findFieldsOnLine(normalizedLines[i]);
      if (entries.length === 0) continue;
      const inlineAmount = this.findCurrencyOnLine(lines[i])?.amount;
      // In Arabic RTL UIs, values are visually to the LEFT of labels which
      // means OCR (top-to-bottom + left-to-right within a row) emits the
      // value's line ABOVE the label's line. We therefore prefer the
      // previous line first, then fall back to the next line for the few
      // layouts (Uber's first breakdown row, Didi's "تم استلام النقد") where
      // the value follows the label.
      let nearbyAmount: number | undefined = inlineAmount;
      let sourceConfMultiplier = 0.85;
      if (nearbyAmount == null && i > 0) {
        const prevHasLabel = findFieldsOnLine(normalizedLines[i - 1]).length > 0;
        if (!prevHasLabel) {
          const prevAmount = this.findCurrencyOnLine(lines[i - 1])?.amount;
          if (prevAmount != null) {
            nearbyAmount = prevAmount;
          }
        }
      }
      if (nearbyAmount == null && i + 1 < normalizedLines.length) {
        const nextHasLabel = findFieldsOnLine(normalizedLines[i + 1]).length > 0;
        if (!nextHasLabel) {
          const nextAmount = this.findCurrencyOnLine(lines[i + 1])?.amount;
          if (nextAmount != null) {
            nearbyAmount = nextAmount;
            // Next-line lookup is now the secondary path — give it a slightly
            // lower confidence so a same-line or prev-line match wins on ties.
            sourceConfMultiplier = 0.8;
          }
        }
      }
      if (nearbyAmount == null) continue;

      for (const entry of entries) {
        if (entry.platforms && !entry.platforms.includes(this.platform)) continue;
        const fieldKey = this.mapDictFieldToParsedKey(entry.field);
        if (!fieldKey) continue;
        const newWeight = entry.weight * sourceConfMultiplier;
        const existing = fields[fieldKey];
        if (existing != null && (perField[fieldKey] ?? 0) >= newWeight) continue;
        (fields as Record<string, unknown>)[fieldKey] = nearbyAmount;
        perField[fieldKey] = newWeight;
      }
    }

    if (fields.grossEgp == null && allAmounts.length > 0) {
      const top = allAmounts.slice().sort((a, b) => a.lineIdx - b.lineIdx)[0];
      fields.grossEgp = top.amount;
      perField.grossEgp = 0.55;
    }
  }

  protected mapDictFieldToParsedKey(
    field: string,
  ): keyof OcrParsedTripDto | null {
    switch (field) {
      case 'fare': return 'grossEgp';
      case 'received': return 'receivedEgp';
      case 'commission': return 'commissionEgp';
      case 'tip': return 'tipEgp';
      case 'bonus': return 'tipEgp';
      case 'waitingFee': return 'waitingFeeEgp';
      case 'toll': return 'tollEgp';
      case 'parking': return 'parkingEgp';
      default: return null;
    }
  }

  protected extractDistance(
    lines: string[],
    _normalizedLines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    // Ride-hailing apps show the WITH-PASSENGER distance ("paid km"). The
    // empty-km portion (driving to pickup, after drop-off) is invisible to the
    // app, so we map the visible value to paidKm — NOT totalKm — and then
    // approximate totalKm = paidKm. The driver can adjust totalKm later on
    // the review screen if they tracked empty km separately.
    for (const line of lines) {
      const km = this.findKmOnLine(line);
      if (km != null && km > 0 && km < 500) {
        if (fields.paidKm == null) {
          fields.paidKm = km;
          perField.paidKm = 0.9;
        }
        break;
      }
    }
  }

  protected derivePaidKm(
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
    warnings: string[],
  ): void {
    // App distance is paidKm; totalKm is approximated to the same value (any
    // empty km the driver drove is not visible on the screenshot).
    if (fields.totalKm == null && fields.paidKm != null) {
      fields.totalKm = fields.paidKm;
      perField.totalKm = 0.55;
      warnings.push('OCR_DISTANCE_IS_PAID_KM');
    }
  }

  protected extractDuration(
    lines: string[],
    _normalizedLines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
    _warnings: string[],
  ): void {
    // `lines` here is the fully-normalized array (letter folding + digit
    // normalization) from parse() — patterns expect ه not ة, 0-9 not ٠-٩.
    for (const line of lines) {
      const norm = line;
      // Note: SemanticNormalizer folds ئ→ي and ة→ه, so patterns use the
      // normalized forms (الدقايق not الدقائق, ثانيه not ثانية).
      let m = norm.match(/(\d{1,2})\s*من\s*الدقا[يئ]ق\s*(\d{1,2})\s*ثاني/);
      if (!m) m = norm.match(/(\d{1,2})\s*(?:دقيقه|دقا[يئ]ق)\s*(\d{1,2})\s*(?:ثاني[هة]|ثواني)/);
      // DiDi abbreviated: "14 د 5 ث" (د = دقائق, ث = ثواني)
      if (!m) m = norm.match(/(\d{1,2})\s*د\s*(\d{1,2})\s*ث(?:$|\s|[^؀-ۿ])/);
      if (!m) m = norm.match(/(\d{1,2})\s*min(?:ute)?s?\s+(\d{1,2})\s*sec(?:ond)?s?/i);
      if (m) {
        const mins = Number(m[1]);
        const secs = Number(m[2]);
        if (Number.isFinite(mins) && Number.isFinite(secs)) {
          fields.durationSec = mins * 60 + secs;
          perField.durationSec = 0.9;
          return;
        }
      }

      m = norm.match(/(\d{1,3})\s*(?:دقيقه|دقا[يئ]ق)(?=$|\s|[^؀-ۿ])/i);
      if (!m) m = norm.match(/(\d{1,3})\s*min(?:utes?)?\b/i);
      if (m) {
        fields.durationSec = Number(m[1]) * 60;
        perField.durationSec = 0.7;
        return;
      }
    }
  }

  protected extractDateTime(
    lines: string[],
    _normalizedLines: string[],
  ): { startedAtIso: string | null; endedAtIso: string | null; confidence: number; ambiguous: boolean } {
    // `lines` here is fully-normalized (letter folding + digit normalization).
    let datePart: { y: number; m: number; d: number } | null = null;
    let timePart: { h: number; m: number; isPm: boolean | null } | null = null;
    let dateConfidence = 0;
    let timeConfidence = 0;
    let ambiguous = false;

    for (const rawLine of lines) {
      const line = rawLine;
      if (!datePart) {
        // Normalizer folds أ→ا, so we accept both forms. Build month lookup keyed
        // on the post-normalization spelling too.
        const mAr = line.match(/(\d{1,2})\s+(يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر)،?\s*(\d{4})/);
        if (mAr) {
          const monthKey = mAr[2].replace(/[أإآ]/g, 'ا');
          datePart = { d: Number(mAr[1]), m: MONTHS_AR[monthKey] ?? MONTHS_AR[mAr[2]] ?? 1, y: Number(mAr[3]) };
          dateConfidence = 0.9;
        }
      }
      if (!datePart) {
        const mEn = line.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{4})/i);
        if (mEn) {
          datePart = { d: Number(mEn[1]), m: MONTHS_EN[mEn[2].toLowerCase()] ?? 1, y: Number(mEn[3]) };
          dateConfidence = 0.85;
        }
      }
      if (!datePart) {
        // ISO-ish: "2026-05-18" or DiDi-style "2026/05/16"
        const mNum = line.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
        if (mNum) {
          datePart = { y: Number(mNum[1]), m: Number(mNum[2]), d: Number(mNum[3]) };
          dateConfidence = 0.85;
        }
      }
      if (!datePart) {
        // Careem: "الجمعة، 15 مايو 2026" — day-name prefix that breaks the
        // simple "<dd> <month_ar> <yyyy>" pattern. Strip the comma+day prefix.
        const mDayPrefix = line.replace(/^(?:الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|السبت)[،,]?\s*/, '');
        const mAr2 = mDayPrefix.match(/(\d{1,2})\s+(يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر)،?\s*(\d{4})/);
        if (mAr2) {
          const monthKey = mAr2[2].replace(/[أإآ]/g, 'ا');
          datePart = { d: Number(mAr2[1]), m: MONTHS_AR[monthKey] ?? MONTHS_AR[mAr2[2]] ?? 1, y: Number(mAr2[3]) };
          dateConfidence = 0.9;
        }
      }

      if (!timePart) {
        // Suffix variant: "10:46 م" / "08:45 PM" / "08:43 ص" — and also the
        // RTL-scrambled order Azure occasionally returns ("08:09.2026/05/16 م"
        // when the source was "2026/05/16، 08:09 م"). The non-capturing group
        // between the time and the suffix absorbs digits, dots, slashes,
        // commas, hyphens, and Arabic commas, so the suffix is still
        // associated with the time.
        const mT = line.match(/(\d{1,2}):(\d{2})(?:[\s.,/،\-\d]*(ص|م|AM|PM|am|pm))?/);
        if (mT) {
          const h = Number(mT[1]);
          const m = Number(mT[2]);
          let isPm: boolean | null = null;
          const suffix = (mT[3] ?? '').toLowerCase();
          if (suffix === 'م' || suffix === 'pm') isPm = true;
          else if (suffix === 'ص' || suffix === 'am') isPm = false;
          else ambiguous = true;
          if (h <= 23 && m <= 59) {
            timePart = { h, m, isPm };
            timeConfidence = isPm == null ? 0.55 : 0.9;
          }
        }
      }
    }

    if (!datePart) return { startedAtIso: null, endedAtIso: null, confidence: 0, ambiguous };

    let hour = timePart?.h ?? 0;
    const minute = timePart?.m ?? 0;
    if (timePart?.isPm === true && hour < 12) hour += 12;
    if (timePart?.isPm === false && hour === 12) hour = 0;

    const iso = `${datePart.y.toString().padStart(4, '0')}-${String(datePart.m).padStart(2, '0')}-${String(datePart.d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
    return {
      startedAtIso: iso,
      endedAtIso: null,
      confidence: Math.min(dateConfidence, timeConfidence > 0 ? timeConfidence : dateConfidence),
      ambiguous,
    };
  }

  protected extractPayment(
    normalizedLines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    let pm: OcrPaymentMethod = 'unknown';
    let conf = 0;
    for (const line of normalizedLines) {
      const hits = findFieldsOnLine(line);
      for (const h of hits) {
        if (h.field === 'paymentCash' && conf < h.weight) { pm = 'cash'; conf = h.weight; }
        else if (h.field === 'paymentCard' && conf < h.weight) { pm = 'card'; conf = h.weight; }
        else if (h.field === 'paymentWallet' && conf < h.weight) { pm = 'wallet'; conf = h.weight; }
      }
    }
    if (pm !== 'unknown') {
      fields.paymentMethod = pm;
      perField.paymentMethod = conf;
    }
  }

  protected extractWaiting(
    normalizedLines: string[],
    fields: Partial<OcrParsedTripDto>,
    _perField: Partial<Record<keyof OcrParsedTripDto, number>>,
    warnings: string[],
  ): void {
    for (const line of normalizedLines) {
      const hits = findFieldsOnLine(line);
      if (hits.some((h) => h.field === 'waitingFee')) {
        warnings.push('OCR_WAITING_FEE_DETECTED');
        if (fields.notes == null) fields.notes = 'Waiting fee detected';
        return;
      }
    }
  }

  protected extractVehicle(
    text: string,
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    for (const [rx, label] of VEHICLE_MAP) {
      if (rx.test(text)) {
        fields.vehicleType = label;
        perField.vehicleType = 0.75;
        return;
      }
    }
  }

  protected extractPickupDestination(
    lines: string[],
    fields: Partial<OcrParsedTripDto>,
    perField: Partial<Record<keyof OcrParsedTripDto, number>>,
  ): void {
    // Uber's pickup/destination lines reliably contain the Egypt country
    // code "EG" (from the embedded Google address). The script + arrangement
    // varies a lot — Azure may emit any of:
    //   - Latin-only:           "Nasr City 4455020 EG"
    //   - Arabic-then-EG:       "مدينة نصر عبد المنعم رياض EG"
    //   - RTL-scrambled:        "4442441 EG مدينة نصر محور المشير محمد علي"
    //                            (postal + EG appear BEFORE the Arabic text)
    // We therefore accept any line containing a word-boundary "EG" with
    // enough surrounding context (>= 10 chars + at least one letter glyph).
    const addressLike = lines.filter((l) => {
      const trimmed = l.trim();
      if (trimmed.length < 10) return false;
      if (!/\bEG\b/.test(trimmed)) return false;
      // Must contain at least one letter — Arabic or Latin — so we don't
      // pick up stray "EG" tokens floating between digit-only rows.
      return /[A-Za-z؀-ۿ]{2,}/.test(trimmed);
    });
    if (addressLike.length >= 1) {
      fields.pickup = addressLike[0].trim();
      perField.pickup = 0.6;
    }
    if (addressLike.length >= 2) {
      fields.destination = addressLike[1].trim();
      perField.destination = 0.6;
    }
  }

  protected extractPlatformHint(fields: Partial<OcrParsedTripDto>): void {
    const map: Record<OcrPlatform, string> = {
      UBER: 'Uber',
      INDRIVE: 'inDrive',
      DIDI: 'DiDi',
      CAREEM: 'Careem',
    };
    fields.appHint = map[this.platform];
  }

  emptyParsed(): OcrParsedTripDto {
    return { ...EMPTY_PARSED };
  }
}
