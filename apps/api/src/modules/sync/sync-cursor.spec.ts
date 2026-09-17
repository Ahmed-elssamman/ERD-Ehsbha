import { BadRequestException } from '@nestjs/common';
import { SYNC_CYCLE_LIFETIME_MS } from '@ehsbha/api-contracts';
import { decodeSyncCursor, encodeSyncCursor, newSyncCursor } from './sync-cursor';
import { SYNC_ENTITY_ORDER } from './sync.control';

describe('sync reconciliation continuations', () => {
  const signingKey = 'test-sync-cursor-signing-key';
  const now = Date.parse('2026-09-17T09:00:00Z');
  const make = () => newSyncCursor('owner', SYNC_ENTITY_ORDER.map(() => 'last-id'), now);

  it('round trips a bounded cycle without extending its lifetime', () => {
    const cursor = make();
    const resumed = decodeSyncCursor(encodeSyncCursor({ ...cursor, family: 3, after: 'item-id' }, signingKey), 'owner', signingKey, now + 1000);
    expect(resumed).toEqual({ ...cursor, family: 3, after: 'item-id' });
  });
  it('rejects a different account and rotated signing key', () => {
    const continuation = encodeSyncCursor(make(), signingKey);
    expect(() => decodeSyncCursor(continuation, 'other', signingKey, now)).toThrow(BadRequestException);
    expect(() => decodeSyncCursor(continuation, 'owner', `${signingKey}-rotated`, now)).toThrow(BadRequestException);
  });
  it('rejects expired and future cycles', () => {
    const continuation = encodeSyncCursor(make(), signingKey);
    expect(() => decodeSyncCursor(continuation, 'owner', signingKey, now + SYNC_CYCLE_LIFETIME_MS)).toThrow(BadRequestException);
    expect(() => decodeSyncCursor(continuation, 'owner', signingKey, now - 1)).toThrow(BadRequestException);
  });
  it('rejects tampered ceilings, positions and malformed legacy tokens', () => {
    const continuation = encodeSyncCursor(make(), signingKey), [payload, signed] = continuation.split('.');
    const altered = Buffer.from(Buffer.from(payload, 'base64url').toString().replace('last-id', 'fake-id')).toString('base64url');
    for (const invalid of [`${altered}.${signed}`, `${continuation}.extra`, '2026-09-16T00:00:00Z', 'x'.repeat(4097), '']) {
      expect(() => decodeSyncCursor(invalid, 'owner', signingKey, now)).toThrow(BadRequestException);
    }
  });
});
