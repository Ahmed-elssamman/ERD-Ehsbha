/**
 * Normalize whatever the user typed into the canonical Egyptian local form:
 * 01XXXXXXXXX (11 digits, starting with 01).
 *
 * Drops "+", spaces, dashes, and any prefix before the first "01" so pasting
 * +20…, 002…, 02…, 20… all collapse to the same 11-digit value.
 *
 * Why: the backend stores numbers in +20 form, but users habitually type the
 * international prefix or paste from contacts. We standardize the visible
 * input to one shape and convert at the boundary.
 */
export function normalizeEgyPhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '');
  const idx = digits.indexOf('01');
  const tail = idx >= 0 ? digits.slice(idx) : digits;
  return tail.slice(0, 11);
}

/** Convert a local 01XXXXXXXXX number into +20 E.164 form for the API. */
export function toE164Egypt(local: string): string {
  const n = normalizeEgyPhone(local);
  if (n.length === 11 && n.startsWith('0')) {
    return `+20${n.slice(1)}`;
  }
  return n;
}

/** Egyptian mobile: "01" followed by 9 digits. */
export const EGY_PHONE_REGEX = /^01\d{9}$/;
