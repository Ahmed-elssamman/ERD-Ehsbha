const ARABIC_INDIC = /[٠-٩]/g;
const PERSIAN = /[۰-۹]/g;
const BIDI_MARKS = /[‎‏‪-‮؜]/g;
const ARABIC_THOUSANDS = /٬/g;
const ARABIC_DECIMAL = /٫/g;

export function stripBidi(input: string): string {
  return input.replace(BIDI_MARKS, '');
}

export function normalizeDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN, (d) => String(d.charCodeAt(0) - 0x06F0));
}

export function normalizeNumeric(input: string): string {
  let s = stripBidi(input);
  s = normalizeDigits(s);
  s = s.replace(ARABIC_THOUSANDS, '');
  s = s.replace(ARABIC_DECIMAL, '.');
  return s;
}

export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = normalizeNumeric(raw).trim();
  if (!s) return null;
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Both present — comma is thousands, dot is decimal.
    s = s.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    const tail = parts[parts.length - 1] ?? '';
    // Heuristic: a single comma with exactly 3 trailing digits looks like
    // thousands (e.g. "1,234"). Anything else (2-digit tail "26,6" or "27,04",
    // or multiple commas like "1,234,5") is treated as decimal — Careem
    // routinely emits 2-digit decimals with a comma. Multi-decimal "104,00"
    // also falls here and resolves to 104.00.
    if (tail.length === 3 && parts.length === 2 && (parts[0]?.length ?? 0) >= 1) {
      s = s.replace(/,/g, '');
    } else {
      // Replace LAST comma with dot (decimal), strip any earlier commas.
      const lastComma = s.lastIndexOf(',');
      s = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1);
    }
  }
  s = s.replace(/(?!^)-/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseInteger(raw: string): number | null {
  const n = parseAmount(raw);
  if (n == null) return null;
  return Math.trunc(n);
}
