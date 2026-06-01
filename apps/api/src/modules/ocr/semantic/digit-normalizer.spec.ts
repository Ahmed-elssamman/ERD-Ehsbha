import { normalizeDigits, normalizeNumeric, parseAmount, parseInteger, stripBidi } from './digit-normalizer';

describe('digit-normalizer', () => {
  describe('normalizeDigits', () => {
    it('translates Arabic-Indic to ASCII', () => {
      expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });
    it('translates Persian to ASCII', () => {
      expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    });
    it('is a no-op on ASCII', () => {
      expect(normalizeDigits('0123456789')).toBe('0123456789');
    });
  });

  describe('stripBidi', () => {
    it('removes RTL/LTR marks', () => {
      expect(stripBidi('a‎b‏c')).toBe('abc');
    });
  });

  describe('parseAmount', () => {
    it('parses dotted decimal', () => {
      expect(parseAmount('27.04')).toBe(27.04);
    });
    it('parses Arabic decimal mark', () => {
      expect(parseAmount('٢٧٫٠٤')).toBe(27.04);
    });
    it('handles thousands+decimal correctly', () => {
      expect(parseAmount('1,234.56')).toBe(1234.56);
    });
    it('treats single trailing 3-digit comma as thousands', () => {
      expect(parseAmount('1,234')).toBe(1234);
    });
    it('treats 2-digit comma as decimal (ar)', () => {
      expect(parseAmount('27,04')).toBe(27.04);
    });
    it('returns null for non-numeric', () => {
      expect(parseAmount('foo')).toBeNull();
    });
    it('strips RTL marks', () => {
      expect(parseAmount('‎27.04‏')).toBe(27.04);
    });
  });

  describe('parseInteger', () => {
    it('truncates decimal', () => {
      expect(parseInteger('27.99')).toBe(27);
    });
  });

  describe('normalizeNumeric', () => {
    it('handles mixed Arabic-Indic + Arabic decimal', () => {
      expect(normalizeNumeric('٢٧٫٠٤')).toBe('27.04');
    });
  });
});
