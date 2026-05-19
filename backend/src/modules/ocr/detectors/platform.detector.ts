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
      /تفاصيل\s*المشوار/i,
      /المبلغ\s*النقدي\s*الذي\s*تم\s*تحصيله/i,
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
    ],
  },
  {
    platform: 'DIDI',
    patterns: [
      /\bdidi\b/i,
      /ديدي/i,
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
