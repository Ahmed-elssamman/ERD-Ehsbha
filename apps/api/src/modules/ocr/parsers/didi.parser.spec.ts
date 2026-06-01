import { DidiParser } from './didi.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import { FIXTURE as AR } from '../__fixtures__/didi-ar.txt';
import { FIXTURE as EN } from '../__fixtures__/didi-en.txt';

describe('DidiParser', () => {
  const parser = new DidiParser(new SemanticNormalizer());

  it('reads fare + commission + received (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.grossEgp).toBeCloseTo(35.0, 2);
    expect(r.fields.commissionEgp).toBeCloseTo(7.0, 2);
    expect(r.fields.receivedEgp).toBeCloseTo(28.0, 2);
  });

  it('reads fare + commission + received (en)', () => {
    const r = parser.parse(EN, []);
    expect(r.fields.grossEgp).toBeCloseTo(35.0, 2);
    expect(r.fields.commissionEgp).toBeCloseTo(7.0, 2);
    expect(r.fields.receivedEgp).toBeCloseTo(28.0, 2);
  });

  it('reads distance + duration', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.totalKm).toBeCloseTo(6.3, 2);
    expect(r.fields.durationSec).toBe(15 * 60);
  });
});
