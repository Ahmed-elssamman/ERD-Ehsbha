import { UberParser } from './uber.parser';
import { IndriveParser } from './indrive.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import type { ReceiptSignals } from '../types';

describe('OCR temporal and receipt integrity', () => {
  const normalizer = new SemanticNormalizer();
  const parser = new UberParser(normalizer);

  it.each([
    '2026-01-16\n08:30 AM',
    '٢٠٢٦-٠١-١٦\n٠٨:٣٠ ص',
  ])('converts Cairo winter clocks to UTC: %s', (text) => {
    expect(parser.parse(text, []).fields.startedAt).toBe('2026-01-16T06:30:00.000Z');
  });

  it.each([
    '2026-02-30\n08:30 AM', '16 مايو\n08:30 AM', '2026-05-16',
    '2026-05-16\n08:30', '2026-05-16\n25:10', '2026-05-16\n10:70 PM',
    '2026-04-24\n12:30 AM', '2026-10-29\n11:30 PM',
  ])('leaves incomplete, invalid, and DST-ambiguous timestamps empty: %s', (text) => {
    const parsed = parser.parse(text, []);
    expect(parsed.fields.startedAt ?? null).toBeNull();
    expect(parsed.warnings).toContain('OCR_TIME_AMBIGUOUS');
  });

  it('does not give inDrive clocks the current date', () => {
    const parsed = new IndriveParser(normalizer).parse('inDrive\n5:30 PM\n6:00 PM', []);
    expect(parsed.fields.startedAt ?? null).toBeNull();
    expect(parsed.fields.endedAt ?? null).toBeNull();
  });

  it('uses the Cairo calendar date when its UTC date is the previous day', () => {
    const parsed = new IndriveParser(normalizer).parse('inDrive\n2026-05-16\n12:10 AM\n12:30 AM', []);
    expect(parsed.fields.startedAt).toBe('2026-05-15T21:10:00.000Z');
    expect(parsed.fields.endedAt).toBe('2026-05-15T21:30:00.000Z');
  });

  it('does not turn a generic receipt total/subtotal into driver fare or net earnings', () => {
    const receipt: ReceiptSignals = {
      total: 100, subtotal: 80, tip: null, tax: null, transactionDate: '2026-05-16',
      transactionTime: null, merchantName: null, meanConfidence: 0.99, isReceipt: true,
    };
    const parsed = parser.parse('Uber', [], { receipt });
    expect(parsed.fields.grossEgp ?? null).toBeNull();
    expect(parsed.fields.receivedEgp ?? null).toBeNull();
    expect(parsed.fields.startedAt ?? null).toBeNull();
  });
});
