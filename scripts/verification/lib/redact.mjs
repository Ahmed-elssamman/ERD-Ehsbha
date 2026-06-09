const SECRET_PATTERNS = [
  { pattern: /(password\s*[:=]\s*)\S+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(access.?token\s*[:=]\s*)\S+/gi, replacement: '$1[REDACTED]' },
  { pattern: /(refresh.?token\s*[:=]\s*)\S+/gi, replacement: '$1[REDACTED]' },
  { pattern: /((?:authorization|Authorization)[:\s]+(?:Bearer\s+)?)\S+/g, replacement: '$1[REDACTED]' },
  { pattern: /(postgres(?:ql)?:\/\/)[^@\s]+@/gi, replacement: '$1[REDACTED]@' },
  { pattern: /(azure.*key\s*[:=]\s*)\S+/gi, replacement: '$1[REDACTED]' },
  { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL REDACTED]' },
  { pattern: /((?:private|secure|internal)\/.*(?:\.png|\.jpg|\.jpeg|\.gif|\.bmp))/gi, replacement: '[PATH REDACTED]' },
  { pattern: /(\b(?:[A-Z0-9_]*)?(?:SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY)\b\s*[:=]\s*)\S+/gi, replacement: '$1[REDACTED]' },
];

export function redact(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function redactObject(obj) {
  if (typeof obj === 'string') return redact(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactObject(value);
    }
    return result;
  }
  return obj;
}

export default redact;
