/**
 * Egyptian phone helpers.
 *
 * Driver enters their phone in local format: 01019579006 (11 digits, starts with 01).
 * Backend stores phones in E.164 international format: +201019579006.
 * These helpers convert between the two.
 */

const LOCAL_EGYPT = /^01[0125][0-9]{8}$/;       // 11 digits, e.g. 01019579006
const E164_EGYPT = /^\+201[0125][0-9]{8}$/;     // +20 + 10 digits

/**
 * Normalize Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin (0-9).
 * Many drivers in Egypt type with the Arabic keyboard active and end up
 * with Arabic digits that don't match our regex or the stored phone.
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
              .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function isValidLocalEgyptPhone(input: string): boolean {
  return LOCAL_EGYPT.test(input.replace(/[\s-]/g, ''));
}

export function isValidE164Phone(input: string): boolean {
  return E164_EGYPT.test(input);
}

/**
 * Normalize ANY of `01019579006`, `+201019579006`, `00201019579006`, `201019579006`
 * to canonical `+201019579006`.
 * Returns null if it can't be parsed.
 */
export function toE164(input: string): string | null {
  if (!input) return null;
  // First normalize Arabic/Persian digits to Latin, then strip separators.
  const cleaned = normalizeDigits(input).replace(/[\s\-()]/g, '');

  if (E164_EGYPT.test(cleaned)) return cleaned;

  // 00201019579006
  if (/^00201[0125][0-9]{8}$/.test(cleaned)) return '+' + cleaned.slice(2);

  // 201019579006
  if (/^201[0125][0-9]{8}$/.test(cleaned)) return '+' + cleaned;

  // 01019579006
  if (LOCAL_EGYPT.test(cleaned)) return '+20' + cleaned.slice(1);

  return null;
}

/**
 * Display an E.164 Egyptian number back as the local 11-digit form.
 * Falls back to the input if not recognized.
 */
export function fromE164(input: string | undefined | null): string {
  if (!input) return '';
  if (E164_EGYPT.test(input)) return '0' + input.slice(3);
  return input;
}
