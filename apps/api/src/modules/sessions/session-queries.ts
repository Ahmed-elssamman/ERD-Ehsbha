import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkSessionView } from '@ehsbha/shared-types';
import { type ListSessionsDto, type WorkSessionHistoryQuery } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { recordCursorScope, recordPosition, nextRecordCursor } from '../../common/pagination/record-cursor';

export async function findSession(database: Prisma.TransactionClient, driverId: string, id: string) {
  const row = await database.session.findFirst({ where: { driverId, id } });
  if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
  return row;
}
export async function listSessions(database: PrismaService, driverId: string, q: ListSessionsDto) {
  const scope = recordCursorScope([driverId, 'sessions', q.from?.toISOString() ?? '', q.to?.toISOString() ?? '', q.view]);
  const position = recordPosition(q.cursor ?? '', scope);
  const where: Prisma.SessionWhereInput = { driverId, deletedAt: q.view === WorkSessionView.Deleted ? { not: null } : null,
    startedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } };
  if (position) where.OR = [{ startedAt: { lt: position.timestamp } }, { startedAt: position.timestamp, id: { lt: position.id } }];
  const rows = await database.session.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
  const items = rows.slice(0, q.limit), last = items.at(-1);
  return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.startedAt, id: last.id }, scope) : null };
}
export async function sessionHistory(database: PrismaService, driverId: string, id: string, q: WorkSessionHistoryQuery) {
  await findSession(database, driverId, id);
  const scope = recordCursorScope([driverId, 'session-history', id]);
  const position = recordPosition(q.cursor ?? '', scope);
  const where: Prisma.SessionRevisionWhereInput = { driverId, sessionId: id };
  if (position) where.OR = [{ createdAt: { lt: position.timestamp } }, { createdAt: position.timestamp, id: { lt: position.id } }];
  const rows = await database.sessionRevision.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1 });
  const items = rows.slice(0, q.limit), last = items.at(-1);
  return { items, nextCursor: rows.length > q.limit && last ? nextRecordCursor({ timestamp: last.createdAt, id: last.id }, scope) : null };
}
