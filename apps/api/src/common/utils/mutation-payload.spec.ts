import { ConflictException } from '@nestjs/common';
import { assertMutationMatches } from './mutation-payload';

describe('Mutation payload replay', () => {
  const record = {
    amountPiastres: 8000,
    occurredAt: new Date('2026-09-15T08:00:00.000Z'),
    notes: null,
  };

  it('accepts equivalent validated dates and amounts', () => {
    expect(() => assertMutationMatches({
      amountPiastres: 8000,
      occurredAt: new Date('2026-09-15T08:00:00.000Z'),
    }, record)).not.toThrow();
  });

  it('rejects a changed financial amount instead of claiming it was saved', () => {
    expect(() => assertMutationMatches({ amountPiastres: 8001 }, record)).toThrow(ConflictException);
  });

  it('rejects a changed timestamp', () => {
    expect(() => assertMutationMatches({ occurredAt: new Date('2026-09-16T08:00:00.000Z') }, record))
      .toThrow(ConflictException);
  });

  it('allows a server-selected timestamp to be absent on a shift retry', () => {
    expect(() => assertMutationMatches({ amountPiastres: 8000 }, record)).not.toThrow();
  });

  it('preserves numeric zero as a value rather than treating it as missing', () => {
    expect(() => assertMutationMatches({ amountPiastres: 0 }, record)).toThrow(ConflictException);
  });
});
