export type CanonicalField =
  | 'fare'
  | 'received'
  | 'commission'
  | 'tip'
  | 'bonus'
  | 'distance'
  | 'paidDistance'
  | 'duration'
  | 'durationMin'
  | 'durationSec'
  | 'pickup'
  | 'destination'
  | 'date'
  | 'time'
  | 'paymentCash'
  | 'paymentCard'
  | 'paymentWallet'
  | 'waitingFee'
  | 'toll'
  | 'parking'
  | 'vehicleType'
  | 'platformBrand';

export type PlatformCode = 'UBER' | 'INDRIVE' | 'DIDI' | 'CAREEM';

export interface DictEntry {
  field: CanonicalField;
  patterns: RegExp[];
  platforms?: PlatformCode[];
  weight: number;
}

const re = (s: string, flags = 'i') => new RegExp(s, flags);

export const DICTIONARY: DictEntry[] = [
  // ---------------- Fare / Gross ----------------
  { field: 'fare', weight: 1.0, patterns: [
    re('اجمالي\\s*الاجره'),
    re('الاجره\\s*الاجماليه'),
    re('اجمالي\\s*المشوار'),
    re('السعر\\s*الاجمالي'),
    re('قيمه\\s*المشوار'),
    re('قيمه\\s*الاجره'),
    re('السعر\\s*المتفق\\s*عليه'),
    re('السعر'),
    re('total\\s+fare'),
    re('final\\s+fare'),
    re('estimated\\s+fare'),
    re('trip\\s+fare'),
    re('your\\s+fare'),
    re('fare\\b'),
  ]},
  // Standalone "الأجرة" as a line label (the most common Uber/Careem layout).
  // Requires whitespace or end-of-line after so it doesn't fire on
  // "الأجرة×15%" (a percentage-calc note) or "أجرة المشوار" (DiDi-specific
  // driver-share line, which has no "ال" prefix and is intentionally not gross).
  { field: 'fare', weight: 1.05, patterns: [
    re('^الاجره(?=\\s|$)'),
  ]},
  { field: 'fare', weight: 1.05, platforms: ['CAREEM'], patterns: [
    re('customer\\s+pays'),
    re('يدفع\\s+العميل'),
    re('^اجمالي\\s*المستلم'),
  ]},
  // DiDi: "تم استلام النقد" = cash physically collected = the price paid.
  // Anchored so it doesn't accidentally fire on "لم يتم استلام" or similar.
  { field: 'fare', weight: 1.1, platforms: ['DIDI'], patterns: [
    re('تم\\s*استلام\\s*النقد'),
  ]},

  // ---------------- Received (income / what driver keeps) ----------------
  { field: 'received', weight: 1.0, patterns: [
    re('المبلغ\\s*النقدي\\s*الذي\\s*تم\\s*تحصيله'),
    re('المبلغ\\s*المحصل'),
    re('المبلغ\\s*المستلم'),
    re('صافي\\s*الارباح'),
    re('صافي\\s*الدخل'),
    re('cash\\s+collected'),
    re('you\\s+earned'),
    re('your\\s+earnings'),
    re('net\\s+earnings'),
    re('net\\s+fare'),
    re('total\\s+earned'),
  ]},
  // Careem-specific: "دخلي" is the big top-card income number. Anchored at
  // start-of-line so it doesn't fire on header strings that happen to contain
  // the word.
  { field: 'received', weight: 1.15, platforms: ['CAREEM'], patterns: [
    re('^دخلي(?=$|\\s|[^\\u0600-\\u06FF])'),
  ]},
  // DiDi-specific: "أرباحك" / "ارباحك" big top-card income number.
  { field: 'received', weight: 1.15, platforms: ['DIDI'], patterns: [
    re('^ا?رباحك(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('^أرباحك(?=$|\\s|[^\\u0600-\\u06FF])'),
  ]},
  // Uber-specific: "الدخل" appears as a label in the earnings breakdown. We
  // anchor to start-of-line so the SAME pattern doesn't match the related but
  // distinct accounting lines "مبالغ الدخل" / "رصيد المشاوير".
  { field: 'received', weight: 1.15, platforms: ['UBER'], patterns: [
    re('^الدخل(?=$|\\s|[^\\u0600-\\u06FF])'),
  ]},

  // ---------------- Commission (service fee, sometimes inc. VAT) ----------------
  // The brief lists these as canonical commission synonyms (AR + EN):
  //   رسوم الخدمة · رسوم المنصة · العمولة · Service Fee · Platform Fee
  // All five are covered below plus app-specific variants we've seen in
  // the wild (Uber/Careem/DiDi/inDrive labels).
  { field: 'commission', weight: 1.0, patterns: [
    re('عموله\\s*المنصه'),
    re('عموله\\s*اوبر'),
    re('عموله\\s*كريم'),
    re('عموله\\s*ديدي'),
    re('عموله\\s*ان\\s*درايف'),
    re('رسوم\\s*الخدمه'),
    re('رسوم\\s*المنصه'),
    re('خصم\\s*التطبيق'),
    re('العموله'),
    re('عموله'),
    re('service\\s+fee'),
    re('platform\\s+fee'),
    re('booking\\s+fee'),
    re('careem\\s+fee'),
    re('uber\\s+fee'),
    re('app\\s+fee'),
    re('commission'),
  ]},
  // Careem: total deduction (service fee + VAT bundled) is "إجمالي المدفوع"
  // inside the "دفعت" section — most accurate single number. Highest weight
  // so it overrides individual deduction lines.
  { field: 'commission', weight: 1.2, platforms: ['CAREEM'], patterns: [
    re('^اجمالي\\s*المدفوع'),
  ]},
  // Partial Careem deduction lines — lower weight, used as fallback when the
  // total line isn't visible.
  { field: 'commission', weight: 1.05, platforms: ['CAREEM'], patterns: [
    re('مدفوعات\\s*قيمه\\s*الخدمه'),
  ]},
  // DiDi: explicit "service fee incl. VAT" line — single best signal.
  { field: 'commission', weight: 1.2, platforms: ['DIDI'], patterns: [
    re('رسوم\\s*الخدمه\\s*شامله\\s*ضريبه'),
  ]},
  // Uber: "رسوم الخدمة" inside the breakdown with a percentage tag.
  { field: 'commission', weight: 1.15, platforms: ['UBER'], patterns: [
    re('^رسوم\\s*الخدمه'),
  ]},

  // ---------------- Tip / Bonus ----------------
  { field: 'tip', weight: 1.0, patterns: [
    re('اكراميه'),
    re('بقشيش'),
    re('tip\\b'),
    re('gratuity'),
  ]},
  { field: 'bonus', weight: 0.8, patterns: [
    re('مكافاه'),
    re('عرض\\s*ترويجي'),
    re('حافز'),
    re('bonus'),
    re('promo'),
    re('incentive'),
    re('promotion'),
  ]},

  // ---------------- Waiting / Toll / Parking ----------------
  { field: 'waitingFee', weight: 1.0, patterns: [
    re('رسوم\\s*وقت\\s*الانتظار'),
    re('رسوم\\s*وقت\\s*انتظار'),
    re('اجره\\s*الانتظار'),
    re('وقت\\s*الانتظار'),
    re('wait(?:ing)?\\s+time\\s+fee'),
    re('wait\\s+fee'),
    re('waiting\\s+fee'),
  ]},
  { field: 'toll', weight: 1.0, patterns: [
    re('رسوم\\s*الطرق'),
    re('رسوم\\s*الكوبري'),
    re('رسوم\\s*المحور'),
    re('toll'),
    re('bridge\\s+fee'),
  ]},
  { field: 'parking', weight: 1.0, patterns: [
    re('انتظار\\s*السياره'),
    re('رسوم\\s*الموقف'),
    re('parking'),
  ]},

  // ---------------- Distance ----------------
  { field: 'distance', weight: 1.0, patterns: [
    re('المسافه\\s*الاجماليه'),
    re('المسافه\\s*المقطوعه'),
    re('اجمالي\\s*المسافه'),
    re('المسافه'),
    re('total\\s+distance'),
    re('trip\\s+distance'),
    re('distance\\b'),
  ]},
  { field: 'paidDistance', weight: 0.9, patterns: [
    re('المسافه\\s*المدفوعه'),
    re('paid\\s+distance'),
    re('billable\\s+distance'),
  ]},

  // ---------------- Duration ----------------
  { field: 'duration', weight: 1.0, patterns: [
    re('المده\\s*الاجماليه'),
    re('وقت\\s*الرحله'),
    re('المده'),
    re('total\\s+time'),
    re('trip\\s+time'),
    re('duration'),
  ]},
  { field: 'durationMin', weight: 0.9, patterns: [
    re('من\\s*الدقائق'),
    re('دقائق'),
    re('دقيقه'),
    re('\\bmin(?:ute)?s?\\b'),
  ]},
  { field: 'durationSec', weight: 0.9, patterns: [
    re('ثانيه'),
    re('ثواني'),
    re('\\bsec(?:ond)?s?\\b'),
  ]},

  // ---------------- Pickup / Destination ----------------
  { field: 'pickup', weight: 1.0, patterns: [
    re('نقطه\\s*الانطلاق'),
    re('موقع\\s*الانطلاق'),
    re('مكان\\s*الركوب'),
    re('من\\s*:'),
    re('pickup'),
    re('from\\s*:'),
    re('start\\s+location'),
  ]},
  { field: 'destination', weight: 1.0, patterns: [
    re('نقطه\\s*الوصول'),
    re('الوجهه'),
    re('مكان\\s*النزول'),
    re('الى\\s*:'),
    re('drop[\\s\\-]?off'),
    re('destination'),
    re('to\\s*:'),
  ]},

  // ---------------- Date / Time ----------------
  { field: 'date', weight: 0.6, patterns: [
    re('التاريخ'),
    re('اليوم'),
    re('\\bdate\\b'),
  ]},
  { field: 'time', weight: 0.6, patterns: [
    re('الوقت'),
    re('الساعه'),
    re('\\btime\\b'),
  ]},

  // ---------------- Payment ----------------
  // Note: JS \b only marks ASCII word boundaries — for Arabic we anchor with
  // (?:^|\s|[^؀-ۿ]) instead.
  { field: 'paymentCash', weight: 1.0, patterns: [
    // Both "نقدي" (adjective) and "نقدا" (adverbial form — common on DiDi /
    // Careem after diacritics stripping). After normalization "نقدًا" → "نقدا".
    re('(?:^|\\s|[^\\u0600-\\u06FF])نقدي(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])نقدا(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])كاش(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('دفع\\s*نقدي'),
    re('الدفع\\s*نقدا'),
    re('\\bcash\\b'),
  ]},
  { field: 'paymentCard', weight: 1.0, patterns: [
    re('(?:^|\\s|[^\\u0600-\\u06FF])بطاقه(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])فيزا(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])كارت(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('\\bcard\\b'),
    re('\\bvisa\\b'),
    re('credit'),
    re('debit'),
  ]},
  { field: 'paymentWallet', weight: 1.0, patterns: [
    re('(?:^|\\s|[^\\u0600-\\u06FF])محفظه(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('كريم\\s*باي'),
    re('\\bfawry\\b'),
    re('\\bwallet\\b'),
    re('careem\\s*pay'),
    re('السداد\\s*عبر\\s*الهاتف'),
    re('mobile\\s+payment'),
  ]},

  // ---------------- Vehicle ----------------
  { field: 'vehicleType', weight: 0.7, patterns: [
    re('سكوتر'),
    re('سيكوتر'),
    re('توك\\s*توك'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])سياره(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('(?:^|\\s|[^\\u0600-\\u06FF])دراجه(?=$|\\s|[^\\u0600-\\u06FF])'),
    re('موتسيكل'),
    re('\\bscooter\\b'),
    re('\\bbike\\b'),
    re('\\bcar\\b'),
    re('\\btuk[\\s\\-]?tuk\\b'),
    re('motorcycle'),
  ]},

  // ---------------- Platform Brand ----------------
  { field: 'platformBrand', weight: 1.0, platforms: ['UBER'], patterns: [
    re('\\buber\\b'),
    re('اوبر'),
    re('تفاصيل\\s*المشوار'),
  ]},
  { field: 'platformBrand', weight: 1.0, platforms: ['INDRIVE'], patterns: [
    re('indrive'),
    re('in\\s*drive'),
    re('ان\\s*درايف'),
    re('انـدرايف'),
  ]},
  { field: 'platformBrand', weight: 1.0, platforms: ['DIDI'], patterns: [
    re('\\bdidi\\b'),
    re('ديدي'),
  ]},
  { field: 'platformBrand', weight: 1.0, platforms: ['CAREEM'], patterns: [
    re('careem'),
    re('كريم'),
    re('الكابتن'),
    re('captain'),
  ]},
];

export function findFieldsOnLine(normalizedLine: string): DictEntry[] {
  const out: DictEntry[] = [];
  for (const entry of DICTIONARY) {
    for (const re of entry.patterns) {
      if (re.test(normalizedLine)) {
        out.push(entry);
        break;
      }
    }
  }
  return out;
}
