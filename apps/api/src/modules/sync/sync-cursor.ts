import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { SYNC_CURSOR_MAX_LENGTH, SYNC_CYCLE_LIFETIME_MS } from '@ehsbha/api-contracts';
import { z } from 'zod';
import { recordCursorScope } from '../../common/pagination/record-cursor';
import { SYNC_ENTITY_ORDER } from './sync.control';

const id = z.string().min(1).max(128);
const cursorSchema = z.object({
  version: z.literal(1), scope: z.string().length(64), cycleId: z.string().uuid(),
  startedAt: z.number().int().nonnegative().safe(),
  family: z.number().int().min(0).max(SYNC_ENTITY_ORDER.length - 1),
  after: id.nullable(), ceilings: z.array(id.nullable()).length(SYNC_ENTITY_ORDER.length),
}).strict();
export interface SyncCursor {
  version: 1;
  scope: string;
  cycleId: string;
  startedAt: number;
  family: number;
  after: string | null;
  ceilings: Array<string | null>;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`ehsbha.sync.reconcile.v1.${payload}`).digest();
}
export function encodeSyncCursor(cursor: SyncCursor, secret: string): string {
  const payload = Buffer.from(JSON.stringify(cursorSchema.parse(cursor))).toString('base64url');
  return `${payload}.${signature(payload, secret).toString('base64url')}`;
}
export function decodeSyncCursor(token: string, driverId: string, secret: string, now = Date.now()): SyncCursor {
  try {
    if (token.length > SYNC_CURSOR_MAX_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw new Error();
    const [payload, signed] = token.split('.');
    const expected = signature(payload, secret), actual = Buffer.from(signed, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString('base64url') !== signed) throw new Error();
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (cursor.scope !== recordCursorScope([driverId, 'sync-reconcile-v1']) || cursor.startedAt > now || now - cursor.startedAt >= SYNC_CYCLE_LIFETIME_MS) throw new Error();
    return cursor;
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
}
export function newSyncCursor(driverId: string, ceilings: Array<string | null>, now = Date.now()): SyncCursor {
  return cursorSchema.parse({ version: 1, scope: recordCursorScope([driverId, 'sync-reconcile-v1']),
    cycleId: randomUUID(), startedAt: now, family: 0, after: null, ceilings });
}
