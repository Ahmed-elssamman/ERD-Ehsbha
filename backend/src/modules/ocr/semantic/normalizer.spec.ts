import { SemanticNormalizer } from './normalizer';
import { findFieldsOnLine } from './dictionary';

describe('SemanticNormalizer', () => {
  const n = new SemanticNormalizer();

  it('strips diacritics', () => {
    expect(n.normalizeText('الأُجرة')).toBe('الاجره');
  });

  it('folds أ إ آ → ا', () => {
    expect(n.normalizeText('أبريل')).toBe('ابريل');
    expect(n.normalizeText('إن درايف')).toBe('ان درايف');
  });

  it('folds ة → ه, ى → ي', () => {
    expect(n.normalizeText('الكابتنة')).toBe('الكابتنه');
    expect(n.normalizeText('على')).toBe('علي');
  });

  it('lowercases english', () => {
    expect(n.normalizeText('Uber Trip Details')).toBe('uber trip details');
  });

  it('collapses whitespace', () => {
    expect(n.normalizeText('  multiple   spaces  ')).toBe('multiple spaces');
  });
});

describe('dictionary lookup', () => {
  const n = new SemanticNormalizer();

  it('finds fare for total fare', () => {
    const hits = findFieldsOnLine(n.normalizeText('Total fare 27.04 EGP'));
    expect(hits.some((h) => h.field === 'fare')).toBe(true);
  });

  it('finds received for cash collected', () => {
    const hits = findFieldsOnLine(n.normalizeText('المبلغ النقدي الذي تم تحصيله: 28.00 ج.م'));
    expect(hits.some((h) => h.field === 'received')).toBe(true);
  });

  it('finds commission for service fee', () => {
    const hits = findFieldsOnLine(n.normalizeText('Service fee 7.00 EGP'));
    expect(hits.some((h) => h.field === 'commission')).toBe(true);
  });

  it('finds commission for عمولة كريم', () => {
    const hits = findFieldsOnLine(n.normalizeText('عمولة كريم: 13.00 ج.م'));
    expect(hits.some((h) => h.field === 'commission')).toBe(true);
  });

  it('returns empty for unrelated text', () => {
    const hits = findFieldsOnLine(n.normalizeText('random unrelated content'));
    expect(hits.length).toBe(0);
  });
});
