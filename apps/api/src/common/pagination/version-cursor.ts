import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const schema = z.object({ scope: z.string().length(64), version: z.number().int().positive() }).strict();
export function versionPosition(cursor: string, scope: string): number | null {
  if (!cursor) return null;
  try {
    const parsed = schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (parsed.scope !== scope) throw new Error('Cursor scope differs');
    return parsed.version;
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
}
export function nextVersionCursor(version: number, scope: string): string {
  return Buffer.from(JSON.stringify({ scope, version })).toString('base64url');
}
