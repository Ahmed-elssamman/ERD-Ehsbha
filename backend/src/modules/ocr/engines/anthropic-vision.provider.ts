import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OcrParsedTripDto, OcrPaymentMethod, OcrPlatform } from '../dto/ocr.dto';
import { OcrProvider, OcrResult, OcrStructuredResult } from './ocr-provider.interface';

const SYSTEM_PROMPT = `You read screenshots of trip-detail / earnings pages from ride-hailing apps used in Egypt — Uber, inDrive, DiDi, Careem — and extract structured trip data with maximum precision.

Screenshots are usually Arabic, sometimes English, sometimes mixed. Pickup/destination addresses are often English embedded inside an Arabic UI. Numeric values may use Western digits (5.70), Arabic-Indic digits (٥٫٧٠), or commas as the decimal separator (Careem: "26,6"). Distance units may appear BEFORE the number ("km 26,6") or AFTER ("5.70 كلم"). Translate ALL digits to ASCII and normalize the decimal separator to "." before reasoning about numbers.

============================================================
FIELD MAPPING — driver's definitions (use these exactly):
============================================================

* grossEgp = THE FARE / PRICE the customer paid for the trip.
* receivedEgp = THE INCOME / NET the driver actually receives.
* commissionEgp = the platform's fee (service fee + VAT if shown bundled).
* tipEgp = explicit tips/promo bonuses added on top.
* waitingFeeEgp = waiting-time fees.
* paidKm = the WITH-PASSENGER distance — the value the app shows under "المسافة" / "Distance" / "كلم" / "كم" / "km". This is the trip distance with the passenger on board. ALWAYS map the visible distance value to paidKm, NEVER to totalKm.
* totalKm = the ALL-IN distance including empty km (driving to pickup, between rides). Ride-hailing apps DO NOT show this. Return null — the system fills it from paidKm and the driver edits later if they tracked empty km separately.
* durationSec = trip duration in total seconds.
* startedAt = the trip START date+time. The single timestamp shown at the top header of the page is the trip start; if a separate pickup-time / dropoff-time pair is visible (Careem map view), use the earlier one.
* endedAt = trip END date+time. If only one timestamp is visible, leave this null — the system computes endedAt = startedAt + durationSec.
* pickup / destination = address strings.
* paymentMethod = cash | card | wallet | unknown.

============================================================
PLATFORM-SPECIFIC RULES — follow precisely:
============================================================

# UBER (look for "تفاصيل المشوار", scooter/car icon, blue accent)

Header line at top: "<vehicle> • <day> <month>، <year> م • <hh>:<mm> م/ص"
  → vehicleType, startedAt.
Big number under header (e.g. "27.04 ج.م") = the driver's INCOME (الدخل). Map to receivedEgp.
"المبلغ النقدي الذي تم تحصيله: 28.00 ج.م" = cash physically collected from passenger. Map to grossEgp (price paid).
Earnings breakdown screen (when visible — second screenshot):
  - "الأجرة: 31.81" = the FULL fare BEFORE platform commission. When this appears, PREFER it as grossEgp over the cash-collected figure (it's more authoritative).
  - "رسوم الخدمة: -4.77 (15%)" = commissionEgp. Strip the minus sign.
  - "الدخل: 27.04" = confirms receivedEgp.
  - "مبالغ الدخل: -28.00" / "رصيد المشاوير: -0.96" = bookkeeping lines, IGNORE these for grossEgp.
"رسوم وقت انتظار" anywhere → set waitingFeeEgp = (receivedEgp - الدخل from breakdown) if both present, else add a "Waiting fee detected" note.
Duration format: "11 من الدقائق 41ثانية" → 11*60+41 = 701 sec.
Distance format: "5.70 كلم".
Vehicle type words: "سكوتر" → scooter, "سيارة" → car.

# CAREEM (look for "Careem"/"كريم", "رحلة في المدينة", green accent, "السداد عبر الهاتف المحمول")

Header has TWO lines: day name + date ("الجمعة، 15 مايو 2026") then time ("08:45 PM"). Note: Careem uses English AM/PM markers even in Arabic UI.
Map view sub-card shows pickup-time + dropoff-time pair: top time = startedAt (boarding), bottom time = endedAt (drop-off).
Distance shown as "km 26,6" — LTR ordering, COMMA decimal. Parse as 26.6.
Duration: "35 دقيقة" → 35*60 = 2100 sec.
Income card "دخلي" big number (e.g. "91,16 ج.م") = receivedEgp. The comma is decimal.
"السداد عبر الهاتف المحمول" / "الدفع نقدًا" — Careem often shows BOTH. The actual payment method is whichever has the colored chip/badge. If unclear, prefer wallet when "السداد عبر الهاتف المحمول" is shown.
"استلمت" section:
  - "الأجرة: 104,00 ج.م" = grossEgp (the price).
  - "إجمالي المستلم: 104,00 ج.م" = same value, total received by passenger-side accounting.
"دفعت" section (what Careem deducted from the driver):
  - "مدفوعات قيمة الخدمة لدينا منخفضة (10.83%): 11,6 ج.م" = service fee.
  - "ضريبة القيمة المضافة: 1,58 ج.م" = VAT.
  - "إجمالي المدفوع: 12,84 ج.م" = total deduction. USE THIS as commissionEgp (it bundles service fee + VAT).
Passenger names ("Hozaifa", "محمد") are in a card with stars below — IGNORE the name and the star rating, do not set notes from them.

# DIDI (look for "DiDi"/"ديدي", "تفاصيل المشاوير", peach/orange accent)

Header: "تفاصيل المشاوير" — there is no inline date here. The trip's date+time appears LOWER, under "تفاصيل المشوار" as "yyyy/MM/dd, HH:mm م/ص" (e.g. "2026/05/16, 08:43 م"). Use that as startedAt.
Top: "أرباحك" then a big number (e.g. "29.87 ج.م") = receivedEgp.
"المسافة 6.7 كم" → 6.7 km.
"المدة 14 د 5 ث" → 14 min 5 sec = 845 sec. ("د" = دقائق, "ث" = ثواني.)
"نوع السيارة: Tayaran" — Tayaran is a car class; map vehicleType to "car".
"طريقة الدفع: نقدًا" → paymentMethod = cash.
"تم استلام النقد: 35.00 ج.م" = grossEgp (cash physically collected = price paid).
"أرباحك" breakdown:
  - "أجرة المشوار (شامل زيادة وقت الذروة): 29.55" — driver's share of the fare incl. peak surge. NOT grossEgp.
  - "رسوم وقت الانتظار: 0.32" → waitingFeeEgp.
  - "إجمالي: 29.87" = confirms receivedEgp.
"دفع الراكب" section: "إجمالي 35.00" = grossEgp (same value as تم استلام النقد).
"مستحقات دي دي المقدَّرة" section: "رسوم الخدمة شاملة ضريبة القيمة المضافة: -4.85" → commissionEgp = 4.85 (strip minus).
"تفاصيل المشوار" address card has the date "2026/05/16, 08:43 م" and pickup/dropoff lines (e.g. "مشروع 19، الحي العاشر، مدينة نصر" / "مساكن المحمودية، الأباجية المقطم").

# INDRIVE (look for "inDrive"/"ان درايف", lime-green accent)

Driver and passenger negotiate fare directly — there's usually NO commission line.
"السعر المتفق عليه: 45.00 ج.م" / "Agreed fare" = grossEgp = receivedEgp (inDrive takes 0).
Set commissionEgp = 0 with note "inDrive no commission" if no fee is visible.
Otherwise standard rules apply.

============================================================
GENERAL FORMATTING RULES:
============================================================

* All money is EGP decimal (e.g. 27.04, NOT piastres). Translate ٠-٩ → 0-9 and "٫" / Careem "," → "." for decimals.
* Distances are km decimals.
* Time markers: ص = AM, م = PM. Convert "08:45 PM" → 20:45. Convert "10:46 م" → 22:46. Convert "08:43 ص" → 08:43.
* startedAt ISO format: "YYYY-MM-DDT HH:MM:00.000Z" — treat local clock time as if already UTC (do NOT shift timezones).
* If endedAt not shown explicitly, leave null — the system derives it from startedAt + durationSec.
* Detect platform via brand keywords, then APPLY THAT PLATFORM'S RULES above. When in doubt between Uber and Careem, the chip/icon at the top-left or the precise field labels (دخلي vs الدخل, إجمالي المستلم vs الأجرة-only) are decisive.
* vehicleType vocabulary: scooter | tuktuk | motorcycle | car | bike | null.
* paidKm: ONLY set if explicitly labeled "Paid distance" / "المسافة المدفوعة". Else leave null — system defaults paid = total.
* If a field is not visible, return null. DO NOT INVENT VALUES.
* notes: keep concise. Examples: "Waiting fee detected", "5-star rating", "Includes peak surge". Don't repeat passenger names or addresses.
* fieldConfidences per field 0..1 based on visual clarity: ≥0.9 crisp text, 0.7-0.9 legible, 0.5-0.7 partial, <0.5 guesses.
* meanConfidence: overall confidence across the screenshot.
* platformConfidence: how confidently you identified the platform.

============================================================
CONCRETE WORKED EXAMPLES:
============================================================

Example 1 (Uber, single summary screenshot):
  Header: "سكوتر • 18 مايو، 2026 م • 10:46 م", Big: "27.04 ج.م",
  "11 من الدقائق 41ثانية", "5.70 كلم",
  Pickup: "Nasr City 4455020 EG", Dropoff: "Ahmed El-Zomor Nasr City 11765 EG",
  "المبلغ النقدي الذي تم تحصيله: 28.00 ج.م", "رسوم وقت انتظار" note visible
  → grossEgp=28.00, receivedEgp=27.04, commissionEgp=null, waitingFeeEgp=0.96 (28-27.04),
    paidKm=5.70, totalKm=null,
    durationSec=701, startedAt="2026-05-18T22:46:00.000Z", endedAt=null (system computes from start+duration),
    vehicleType="scooter", paymentMethod="cash", platform="UBER", notes="Waiting fee detected"

Example 2 (Uber, with breakdown screen visible — prefer this):
  Same header + "الأجرة 31.81", "رسوم الخدمة -4.77 (15%)", "الدخل 27.04", "مبالغ الدخل -28.00", "رصيد المشاوير -0.96"
  → grossEgp=31.81, commissionEgp=4.77, receivedEgp=27.04, waitingFeeEgp=0.96 (cash 28 - الدخل 27.04),
    paidKm=5.70, totalKm=null, durationSec=701, startedAt="2026-05-18T22:46:00.000Z", endedAt=null

Example 3 (Careem):
  "الجمعة، 15 مايو 2026", "08:45 PM", "El-Fardous" / "Yehia Salem Elbanna", "km 26,6", "35 دقيقة",
  Passenger "Hozaifa", "دخلي 91,16 ج.م", "السداد عبر الهاتف المحمول",
  "استلمت → الأجرة 104,00", "إجمالي المستلم 104,00",
  "دفعت → مدفوعات قيمة الخدمة 11,6 (10.83%)", "ضريبة القيمة المضافة 1,58", "إجمالي المدفوع 12,84"
  Map sub-card: 08:10 PM → 08:45 PM
  → grossEgp=104.00, receivedEgp=91.16, commissionEgp=12.84,
    paidKm=26.6, totalKm=null, durationSec=2100,
    startedAt="2026-05-15T20:10:00.000Z" (pickup time from map card),
    endedAt="2026-05-15T20:45:00.000Z" (dropoff time from map card),
    pickup="Yehia Salem Elbanna", destination="El-Fardous",
    paymentMethod="wallet", platform="CAREEM", vehicleType="car"

Example 4 (DiDi):
  "تفاصيل المشاوير", "أرباحك 29.87 ج.م", "المسافة 6.7 كم", "المدة 14 د 5 ث",
  "نوع السيارة: Tayaran", "طريقة الدفع: نقدًا", "تم استلام النقد: 35.00",
  "أجرة المشوار 29.55", "رسوم وقت الانتظار 0.32", "إجمالي 29.87",
  "إجمالي 35.00" (passenger), "رسوم الخدمة شاملة ضريبة القيمة المضافة -4.85",
  "2026/05/16, 08:43 م", pickup "مشروع 19، الحي العاشر، مدينة نصر", dropoff "مساكن المحمودية"
  → grossEgp=35.00, receivedEgp=29.87, commissionEgp=4.85, waitingFeeEgp=0.32,
    paidKm=6.7, totalKm=null, durationSec=845,
    startedAt="2026-05-16T20:43:00.000Z", endedAt=null (system computes from start+duration),
    pickup="مشروع 19، الحي العاشر، مدينة نصر", destination="مساكن المحمودية",
    paymentMethod="cash", platform="DIDI", vehicleType="car"

Always call submit_trip_extraction with your extracted data. Do NOT include any text outside the tool call.`;

const TOOL_DEFINITION = {
  name: 'submit_trip_extraction',
  description: 'Submit the extracted trip data from the transportation app screenshot',
  input_schema: {
    type: 'object' as const,
    properties: {
      platform: { type: ['string', 'null'], enum: ['UBER', 'INDRIVE', 'DIDI', 'CAREEM', null] },
      platformConfidence: { type: 'number', minimum: 0, maximum: 1 },
      meanConfidence: { type: 'number', minimum: 0, maximum: 1 },
      vehicleType: { type: ['string', 'null'] },
      startedAt: { type: ['string', 'null'], description: 'ISO 8601 timestamp e.g. 2026-05-18T22:46:00.000Z' },
      endedAt: { type: ['string', 'null'], description: 'ISO 8601 timestamp' },
      durationSec: { type: ['integer', 'null'] },
      grossEgp: { type: ['number', 'null'] },
      receivedEgp: { type: ['number', 'null'] },
      commissionEgp: { type: ['number', 'null'] },
      tipEgp: { type: ['number', 'null'] },
      tollEgp: { type: ['number', 'null'] },
      parkingEgp: { type: ['number', 'null'] },
      waitingFeeEgp: { type: ['number', 'null'] },
      totalKm: { type: ['number', 'null'] },
      paidKm: { type: ['number', 'null'] },
      pickup: { type: ['string', 'null'] },
      destination: { type: ['string', 'null'] },
      paymentMethod: { type: 'string', enum: ['cash', 'card', 'wallet', 'unknown'] },
      notes: { type: ['string', 'null'] },
      fieldConfidences: {
        type: 'object',
        description: 'Per-field confidence 0..1 keyed by field name',
        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    required: [
      'platform', 'platformConfidence', 'meanConfidence',
      'grossEgp', 'totalKm', 'paymentMethod', 'fieldConfidences',
    ],
  },
};

interface ExtractedToolInput {
  platform: OcrPlatform | null;
  platformConfidence: number;
  meanConfidence: number;
  vehicleType: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  grossEgp: number | null;
  receivedEgp: number | null;
  commissionEgp: number | null;
  tipEgp: number | null;
  tollEgp: number | null;
  parkingEgp: number | null;
  waitingFeeEgp: number | null;
  totalKm: number | null;
  paidKm: number | null;
  pickup: string | null;
  destination: string | null;
  paymentMethod: OcrPaymentMethod;
  notes: string | null;
  fieldConfidences: Record<string, number>;
}

@Injectable()
export class AnthropicVisionProvider implements OcrProvider {
  private readonly logger = new Logger(AnthropicVisionProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async warmUp(): Promise<void> {
    // Anthropic SDK is stateless; no warm-up needed. The cached system prompt
    // pre-warms on the first real request.
  }

  async dispose(): Promise<void> {
    // No-op.
  }

  async recognize(buf: Buffer): Promise<OcrResult> {
    const s = await this.recognizeStructured(buf);
    return { text: s.text, words: [], meanConfidence: s.meanConfidence };
  }

  async recognizeStructured(buf: Buffer): Promise<OcrStructuredResult> {
    const b64 = buf.toString('base64');
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        tools: [TOOL_DEFINITION],
        tool_choice: { type: 'tool', name: 'submit_trip_extraction' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: b64 },
              },
              { type: 'text', text: 'Extract the trip details from this screenshot.' },
            ],
          },
        ],
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      this.logger.error(`Anthropic vision call failed: ${e.message}`);
      const wrapped = new Error(e.status === 429 ? 'OCR_BUSY' : 'OCR_FAILED');
      (wrapped as Error & { code?: string }).code = e.status === 429 ? 'OCR_BUSY' : 'OCR_FAILED';
      throw wrapped;
    }

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new ServiceUnavailableException({
        code: 'OCR_FAILED',
        message: 'Vision model returned no structured output',
      });
    }
    const input = toolUse.input as ExtractedToolInput;
    return this.toStructured(input);
  }

  /** Exposed for unit testing — converts a tool_use input into the structured result. */
  toStructured(input: ExtractedToolInput): OcrStructuredResult {
    const parsed: OcrParsedTripDto = {
      vehicleType: input.vehicleType,
      appHint: input.platform,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationSec: input.durationSec,
      grossEgp: input.grossEgp,
      receivedEgp: input.receivedEgp,
      tipEgp: input.tipEgp,
      commissionEgp: input.commissionEgp,
      tollEgp: input.tollEgp,
      parkingEgp: input.parkingEgp,
      waitingFeeEgp: input.waitingFeeEgp,
      totalKm: input.totalKm,
      paidKm: input.paidKm ?? input.totalKm,
      pickup: input.pickup,
      destination: input.destination,
      paymentMethod: input.paymentMethod ?? 'unknown',
      notes: input.notes,
    };

    const fc = clampedConfidences(input.fieldConfidences ?? {});

    const text = serializeForDebug(parsed);
    return {
      text,
      parsed,
      platform: input.platform,
      platformConfidence: clamp01(input.platformConfidence),
      fieldConfidences: fc,
      meanConfidence: clamp01(input.meanConfidence),
    };
  }
}

function clamp01(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampedConfidences(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = clamp01(v);
  }
  return out;
}

function serializeForDebug(p: OcrParsedTripDto): string {
  const lines: string[] = [];
  if (p.appHint) lines.push(`platform=${p.appHint}`);
  if (p.startedAt) lines.push(`startedAt=${p.startedAt}`);
  if (p.endedAt) lines.push(`endedAt=${p.endedAt}`);
  if (p.durationSec != null) lines.push(`duration=${p.durationSec}s`);
  if (p.grossEgp != null) lines.push(`gross=${p.grossEgp} EGP`);
  if (p.receivedEgp != null) lines.push(`received=${p.receivedEgp} EGP`);
  if (p.commissionEgp != null) lines.push(`commission=${p.commissionEgp} EGP`);
  if (p.totalKm != null) lines.push(`distance=${p.totalKm} km`);
  if (p.pickup) lines.push(`pickup=${p.pickup}`);
  if (p.destination) lines.push(`destination=${p.destination}`);
  if (p.paymentMethod) lines.push(`payment=${p.paymentMethod}`);
  return lines.join('\n');
}
