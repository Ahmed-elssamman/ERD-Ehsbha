/**
 * Number-input normalization helpers.
 *
 * Drivers across MENA enter numbers in different forms:
 *   - Latin digits: "12.5"
 *   - Arabic-Indic digits: "١٢٫٥"
 *   - Persian digits: "۱۲٫۵"
 *   - With comma decimal: "12,5"   (Arabic + many European keyboards)
 *   - With Arabic decimal sep: "12٫5"
 *   - With period: "12.5"
 *
 * These helpers convert ALL of those to a parseable Latin string so we never
 * silently reject valid prices/distances.
 */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function latinizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

/**
 * Decimal-friendly input: accepts digits + one decimal separator.
 * Use this for money, distance, liters, anything that may be fractional.
 *
 * Example flow:
 *   user types  "١٢٫٥٠"  →  "12.50"  →  Number(...)  →  12.5
 */
export function normalizeNumberInput(input: string): string {
  if (!input) return '';
  let s = latinizeDigits(input)
    // Any decimal separator → period
    .replace(/[,٫،]/g, '.')
    // Drop everything that's not a digit or period
    .replace(/[^\d.]/g, '');

  // Keep only the first period — collapse any extras
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s;
}

/**
 * Integer input: accepts digits only.
 * Use this for year, duration in whole minutes, intervals, ratings, etc.
 */
export function normalizeIntInput(input: string): string {
  if (!input) return '';
  return latinizeDigits(input).replace(/[^\d]/g, '');
}

/**
 * Parse a (possibly normalized) string into a number, returning 0 for empty
 * or unparseable values. Safe to use in handlers that need a numeric value.
 */
export function parseNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0;
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const n = Number(normalizeNumberInput(input));
  return Number.isFinite(n) ? n : 0;
}
