import { SYNC_CYCLE_LIFETIME_MS, type PullDto, type SyncPullResponse } from '@ehsbha/api-contracts';
import { SyncPullMode } from '@ehsbha/shared-types';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeSyncCursor, encodeSyncCursor, newSyncCursor } from './sync-cursor';
import { readSyncPage, syncCeilings } from './sync-queries';
import { SYNC_ENTITY_ORDER } from './sync.control';

export async function pullSync(prisma: PrismaService, driverId: string, dto: PullDto): Promise<SyncPullResponse> {
  const signingKey = loadEnv().JWT_ACCESS_SECRET, now = new Date();
  const cursor = dto.cursor ? decodeSyncCursor(dto.cursor, driverId, signingKey, now.getTime())
    : newSyncCursor(driverId, await syncCeilings(prisma, driverId, now), now.getTime());
  // Reading one extra row decides continuation without a separate count query.
  const page = await readSyncPage(prisma, driverId, cursor, dto.limit + 1, now);
  const hasMore = page.items.length > dto.limit;
  if (hasMore) page.items.pop();
  const last = page.items.at(-1);
  const next = hasMore && last ? { ...cursor, after: last.id }
    : cursor.family + 1 < SYNC_ENTITY_ORDER.length ? { ...cursor, family: cursor.family + 1, after: null } : null;
  return { mode: SyncPullMode.Reconcile, cycleId: cursor.cycleId,
    startedAt: new Date(cursor.startedAt).toISOString(), expiresAt: new Date(cursor.startedAt + SYNC_CYCLE_LIFETIME_MS).toISOString(),
    page, nextCursor: next ? encodeSyncCursor(next, signingKey) : null };
}
