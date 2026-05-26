import { Injectable } from '@nestjs/common';
import { OcrPlatform } from '../dto/ocr.dto';
import { SemanticNormalizer } from '../semantic/normalizer';

interface PlatformSignals {
  platform: OcrPlatform;
  patterns: RegExp[];
}

const SIGNALS: PlatformSignals[] = [
  {
    platform: 'UBER',
    patterns: [
      /\buber\b/i,
      /اوبر/i,
      // Anchor to (end-of-string | space | non-Arabic char) so this does
      // NOT also match DiDi's "تفاصيل المشاوير" (the plural form, which
      // contains "المشوار" as a substring).
      /تفاصيل\s*المشوار(?=$|\s|[^؀-ۿ])/i,
      /المبلغ\s*النقدي\s*الذي\s*تم\s*تحصيله/i,
      // Uber breakdown labels — "مبالغ الدخل" / "رصيد المشاوير" / "رسوم الخدمة الأجرة×15%"
      // appear only on the Uber detail screen.
      /مبالغ\s*الدخل/i,
      /رصيد\s*المشاوير/i,
    ],
  },
  {
    platform: 'INDRIVE',
    patterns: [
      /indrive/i,
      /in\s*drive/i,
      /ان\s*درايف/i,
      /السعر\s*المتفق\s*عليه/i,
      /agreed\s+fare/i,
      // Income card big number label — InDrive-specific.
      /(?:^|\n)\s*دخلي\s*$/im,
      // Receipt sections unique to InDrive's earnings layout.
      /إجمالي\s*المستلم/i,
      /اجمالي\s*المستلم/i,
      /إجمالي\s*المدفوع/i,
      /اجمالي\s*المدفوع/i,
      /السداد\s*عبر\s*الهاتف/i,
      /مدفوعات\s*قيمه\s*الخدمه\s*لدينا/i,
    ],
  },
  {
    platform: 'DIDI',
    patterns: [
      /\bdidi\b/i,
      /ديدي/i,
      // Header is plural "تفاصيل المشاوير" — distinguishes from Uber's
      // singular "تفاصيل المشوار".
      /تفاصيل\s*المشاوير/i,
      /مستحقات\s*دي\s*دي/i,
      // Card-pay label unique to DiDi Egypt.
      /الدفع\s*الإلكتروني/i,
      /الدفع\s*الالكتروني/i,
      // DiDi vehicle category brand visible at the top of every trip.
      /\btayaran\b/i,
      // Driver income card label.
      /(?:^|\n)\s*أرباحك\s*$/im,
      /(?:^|\n)\s*ارباحك\s*$/im,
      // Rider-side fare breakdown — DiDi-specific layout.
      /المدفوع\s*من\s*الراكب/i,
      /خصومات\s*الراكب/i,
    ],
  },
  {
    platform: 'CAREEM',
    patterns: [
      /careem/i,
      /كريم/i,
      /الكابتن/i,
      /\bcaptain\b/i,
      /customer\s+pays/i,
      /يدفع\s+العميل/i,
    ],
  },
];

@Injectable()
export class PlatformDetector {
  constructor(private readonly normalizer: SemanticNormalizer) {}

  detect(texts: string[]): { platform: OcrPlatform | null; confidence: number; scores: Record<OcrPlatform, number> } {
    const haystack = texts.map((t) => this.normalizer.normalizeText(t)).join(' \n ');
    const scores: Record<OcrPlatform, number> = { UBER: 0, INDRIVE: 0, DIDI: 0, CAREEM: 0 };
    for (const sig of SIGNALS) {
      for (const re of sig.patterns) {
        const m = haystack.match(new RegExp(re.source, 'gi'));
        if (m) scores[sig.platform] += m.length;
      }
    }
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total === 0) return { platform: null, confidence: 0, scores };
    const [topPlatform, topScore] = (Object.entries(scores) as Array<[OcrPlatform, number]>)
      .sort((a, b) => b[1] - a[1])[0];
    if (topScore < 1) return { platform: null, confidence: 0, scores };
    const confidence = Math.min(1, topScore / Math.max(total, 1));
    return { platform: topPlatform, confidence, scores };
  }
}
