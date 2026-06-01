/**
 * Canonicalize Egyptian phone numbers to E.164 (+20…) form.
 *
 * Strips spaces, dashes, "+", and any prefix before the first "01". So pasting
 * `+0201019579006`, `00201019579006`, `0201019579006`, `01019579006`, or
 * `+201019579006` all collapse to `+201019579006`.
 *
 * Why: the frontend canonicalizes the same way before sending, but legacy
 * accounts may have been stored in any of these shapes. Canonicalizing on
 * the server too lets a single user record match no matter how the digits
 * are typed today or were typed yesterday.
 */
export function canonicalizeEgyPhone(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D+/g, '');
  const idx = digits.indexOf('01');
  const tail = idx >= 0 ? digits.slice(idx) : digits;
  if (tail.length === 11 && tail.startsWith('0')) {
    return `+20${tail.slice(1)}`;
  }
  // Could not confidently canonicalize — return the cleaned input so the
  // caller can still try the lookup, and let validation reject if needed.
  return trimmed;
}

/**
 * Yield the canonical form first, then a few common legacy shapes a user
 * might already exist under. Used during login as a tolerant fallback so a
 * record saved before normalization still matches.
 */
export function egyPhoneLookupCandidates(input: string): string[] {
  const canonical = canonicalizeEgyPhone(input);
  const candidates = new Set<string>([canonical, input, input.trim()]);
  // Also try the local form (01XXXXXXXXX) — some legacy rows may be stored
  // without the +20 prefix.
  if (canonical.startsWith('+20')) {
    candidates.add(`0${canonical.slice(3)}`);
  }
  return Array.from(candidates).filter(Boolean);
}
