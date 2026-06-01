import { CareemParser } from './careem.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import { FIXTURE as AR } from '../__fixtures__/careem-ar.txt';
import { FIXTURE as EN } from '../__fixtures__/careem-en.txt';

describe('CareemParser', () => {
  const parser = new CareemParser(new SemanticNormalizer());

  it('reads customer pays (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.grossEgp).toBeCloseTo(52.0, 2);
  });

  it('reads Careem fee as commission (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.commissionEgp).toBeCloseTo(13.0, 2);
  });

  it('reads received (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.receivedEgp).toBeCloseTo(39.0, 2);
  });

  it('reads card payment (ar)', () => {
    const r = parser.parse(AR, []);
    expect(r.fields.paymentMethod).toBe('card');
  });

  it('reads customer pays (en)', () => {
    const r = parser.parse(EN, []);
    expect(r.fields.grossEgp).toBeCloseTo(52.0, 2);
    expect(r.fields.commissionEgp).toBeCloseTo(13.0, 2);
  });
});
