import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const positionSchema = z.object({ scope: z.string().length(64), version: z.number().int().positive() }).strict();
export function reportHistoryPosition(cursor: string, scope: string): number | null {
  if (!cursor) return null;
  try {
    const value = positionSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (value.scope !== scope) throw new Error('Report history scope differs');
    return value.version;
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
}
export function reportHistoryCursor(version: number, scope: string): string { return Buffer.from(JSON.stringify({ version, scope })).toString('base64url'); }
