import { ConflictException } from '@nestjs/common';

/** Compare validated scalar write fields, including dates and optional nulls. */
export function assertMutationMatches<T extends object>(submitted: Partial<T>, stored: T): void {
  const fields = Object.keys(submitted) as Array<keyof T>;
  for (const field of fields) {
    const submittedValue = submitted[field];
    const storedValue = stored[field];
    const expected = submittedValue instanceof Date
      ? submittedValue.toISOString()
      : String(submittedValue ?? '');
    const actual = storedValue instanceof Date
      ? storedValue.toISOString()
      : String(storedValue ?? '');
    if (expected !== actual) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
  }
}
