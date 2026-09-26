import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const positionSchema = z.object({ timestamp: z.string().datetime({ offset: true }), id: z.string().min(1).max(128), scope: z.string().length(64) }).strict();
export interface RecordPosition { timestamp: Date; id: string }

export function recordCursorScope(parts: string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
export function recordPosition(cursor: string, scope: string): RecordPosition | null {
  if (!cursor) return null;
  try {
    const value = positionSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (value.scope !== scope) throw new Error('Cursor scope differs');
    return { timestamp: new Date(value.timestamp), id: value.id };
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
}
export function nextRecordCursor(position: RecordPosition, scope: string): string {
  return Buffer.from(JSON.stringify({ timestamp: position.timestamp.toISOString(), id: position.id, scope })).toString('base64url');
}
