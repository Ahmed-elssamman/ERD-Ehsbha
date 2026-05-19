import { ConfidenceScorer } from './scorer';

describe('ConfidenceScorer', () => {
  const scorer = new ConfidenceScorer();

  it('multiplies by OCR mean and platform confidence', () => {
    const { final } = scorer.score({ grossEgp: 1.0 }, 1.0, 1.0);
    expect(final.grossEgp).toBeCloseTo(1.0, 2);
  });

  it('reduces score when OCR mean is low', () => {
    const { final } = scorer.score({ grossEgp: 1.0 }, 1.0, 0);
    expect(final.grossEgp).toBe(0.5);
  });

  it('reduces score when platform confidence is low', () => {
    const { final } = scorer.score({ grossEgp: 1.0 }, 0, 1.0);
    expect(final.grossEgp).toBe(0.7);
  });

  it('clamps to [0, 1]', () => {
    const { final } = scorer.score({ grossEgp: 5.0 }, 1.0, 1.0);
    expect(final.grossEgp).toBeLessThanOrEqual(1);
  });

  it('emits low-confidence warnings for required fields', () => {
    const { warnings } = scorer.score({ grossEgp: 0.5 }, 0.4, 0.4);
    expect(warnings).toContain('OCR_LOW_CONFIDENCE_grossEgp');
  });
});
