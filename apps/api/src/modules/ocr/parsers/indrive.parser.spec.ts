import { IndriveParser } from './indrive.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import { FIXTURE as AR } from '../__fixtures__/indrive-ar.txt';
import { FIXTURE as EN } from '../__fixtures__/indrive-en.txt';

describe('IndriveParser', () => {
  const parser = new IndriveParser(new SemanticNormalizer());

  it('reads agreed fare (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.grossEgp).toBeCloseTo(45.0, 2);
  });

  it('defaults commission to 0 with warning (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.commissionEgp).toBe(0);
    expect(r.warnings).toContain('OCR_INDRIVE_NO_COMMISSION_LINE');
  });

  it('reads distance + duration (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.totalKm).toBeCloseTo(8.2, 2);
    expect(r.fields.durationSec).toBe(18 * 60);
  });

  it('reads agreed fare (en)', () => {
    const r = parser.parse(EN, []);
    expect(r.fields.grossEgp).toBeCloseTo(45.0, 2);
  });

  it('sets app hint', () => {
    expect(parser.parse(AR, []).fields.appHint).toBe('inDrive');
  });
});
