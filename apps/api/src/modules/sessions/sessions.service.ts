import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type Session } from '@prisma/client';
import { WorkSessionChange, WorkSessionMutation } from '@ehsbha/shared-types';
import { StartSessionSchema, EndSessionSchema, CreateWorkSessionSchema, CorrectWorkSessionSchema, WorkSessionVersionSchema,
  type StartSessionDto, type EndSessionDto, type CreateWorkSessionDto, type CorrectWorkSessionDto,
  type WorkSessionVersionDto, type ListSessionsDto, type WorkSessionHistoryQuery } from '@ehsbha/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_TRANSACTION_TIMEOUT_MS } from '../aggregates/aggregate.control';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { assertDriverReferences, type DriverReferences } from '../../common/authorization/driver-ownership';
import { assertMutationMatches } from '../../common/utils/mutation-payload';
import { diffMinutes } from '../../common/utils/date';
import { findMutationReceipt, mutationFingerprint, saveMutationReceipt } from '../../common/operations/mutation-receipt';
import { recordSessionChange } from './session-history';
import { findSession, listSessions, sessionHistory } from './session-queries';
import { assertRecordedSessionTime, assertSessionInterval, assertSessionVersion } from './session-validation';
export { StartSessionSchema, EndSessionSchema, ListSessionsSchema } from '@ehsbha/api-contracts';
export type { StartSessionDto, EndSessionDto, ListSessionsDto } from '@ehsbha/api-contracts';
export interface EndSessionFields { endedAt?: Date; expectedVersion: number }

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  list(driverId: string, q: ListSessionsDto) { return listSessions(this.prisma, driverId, q); }
  get(driverId: string, id: string) { return findSession(this.prisma, driverId, id); }
  history(driverId: string, id: string, q: WorkSessionHistoryQuery) { return sessionHistory(this.prisma, driverId, id, q); }
  getOpen(driverId: string) {
    return this.prisma.session.findFirst({ where: { driverId, endedAt: null, deletedAt: null }, orderBy: { startedAt: 'desc' } });
  }

  private execute(driverId: string, kind: WorkSessionMutation, clientMutationId: string, payload: object,
    apply: (tx: Prisma.TransactionClient) => Promise<Session>, references: DriverReferences = {}): Promise<Session> {
    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      await assertDriverReferences(tx, driverId, references);
      const hash = mutationFingerprint(kind, payload);
      const receipt = await findMutationReceipt(tx, driverId, clientMutationId, hash);
      if (receipt) return findSession(tx, driverId, receipt.recordId);
      const row = await apply(tx);
      await saveMutationReceipt(tx, driverId, clientMutationId, hash, row.id);
      return row;
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async start(driverId: string, dto: StartSessionDto) {
    const parsed = StartSessionSchema.parse(dto), { clientMutationId, ...fields } = parsed;
    return this.execute(driverId, WorkSessionMutation.Start, clientMutationId, fields,
      (tx) => this.startInTransaction(tx, driverId, parsed), fields);
  }
  async startInTransaction(tx: Prisma.TransactionClient, driverId: string, dto: StartSessionDto) {
    await lockDriverWrites(tx, driverId);
    await assertDriverReferences(tx, driverId, dto);
    const duplicate = await tx.session.findUnique({ where: { driverId_clientMutationId: { driverId, clientMutationId: dto.clientMutationId } } });
    if (duplicate) { assertMutationMatches(dto, duplicate); return duplicate; }
    const startedAt = dto.startedAt ?? new Date();
    assertRecordedSessionTime(startedAt);
    const open = await tx.session.findFirst({ where: { driverId, endedAt: null, deletedAt: null } });
    if (open) throw new ConflictException({ code: 'SESSION_ALREADY_OPEN' });
    const row = await tx.session.create({ data: { driverId, driverAppId: dto.driverAppId ?? null, startedAt, clientMutationId: dto.clientMutationId } });
    await recordSessionChange(tx, row, WorkSessionChange.Started);
    return row;
  }

  async end(driverId: string, id: string, dto: EndSessionDto) {
    const { clientMutationId, ...fields } = EndSessionSchema.parse(dto);
    return this.execute(driverId, WorkSessionMutation.End, clientMutationId, { id, ...fields }, (tx) => this.endInTransaction(tx, driverId, id, fields));
  }
  async endInTransaction(tx: Prisma.TransactionClient, driverId: string, id: string, dto: EndSessionFields) {
    await lockDriverWrites(tx, driverId);
    const before = await findSession(tx, driverId, id);
    if (before.deletedAt) throw new ConflictException({ code: 'SESSION_STATE_CONFLICT' });
    if (before.endedAt) throw new ConflictException({ code: 'SESSION_ALREADY_ENDED' });
    assertSessionVersion(before, dto.expectedVersion);
    const endedAt = dto.endedAt ?? new Date();
    assertSessionInterval(before.startedAt, endedAt);
    const after = await tx.session.update({ where: { id }, data: { endedAt, activeMinutes: diffMinutes(before.startedAt, endedAt), version: { increment: 1 } } });
    await recordSessionChange(tx, after, WorkSessionChange.Ended, before);
    await this.refresh(tx, after, before);
    return after;
  }

  async create(driverId: string, dto: CreateWorkSessionDto) {
    const { clientMutationId, ...fields } = CreateWorkSessionSchema.parse(dto);
    return this.execute(driverId, WorkSessionMutation.Create, clientMutationId, fields, async (tx) => {
      assertSessionInterval(fields.startedAt, fields.endedAt);
      const after = await tx.session.create({ data: { driverId, ...fields, clientMutationId, activeMinutes: diffMinutes(fields.startedAt, fields.endedAt) } });
      await recordSessionChange(tx, after, WorkSessionChange.Created);
      await this.refresh(tx, after);
      return after;
    });
  }
  async correct(driverId: string, id: string, dto: CorrectWorkSessionDto) {
    const { clientMutationId, ...fields } = CorrectWorkSessionSchema.parse(dto);
    return this.execute(driverId, WorkSessionMutation.Correct, clientMutationId, { id, ...fields }, async (tx) => {
      const before = await findSession(tx, driverId, id);
      assertSessionVersion(before, fields.expectedVersion);
      if (before.deletedAt || !before.endedAt) throw new ConflictException({ code: 'SESSION_STATE_CONFLICT' });
      assertSessionInterval(fields.startedAt, fields.endedAt);
      const after = await tx.session.update({ where: { id }, data: { startedAt: fields.startedAt, endedAt: fields.endedAt,
        activeMinutes: diffMinutes(fields.startedAt, fields.endedAt), version: { increment: 1 } } });
      await recordSessionChange(tx, after, WorkSessionChange.Corrected, before);
      await this.refresh(tx, after, before);
      return after;
    });
  }
  async remove(driverId: string, id: string, dto: WorkSessionVersionDto) { return this.setDeleted(driverId, id, dto, true); }
  async restore(driverId: string, id: string, dto: WorkSessionVersionDto) { return this.setDeleted(driverId, id, dto, false); }
  private async setDeleted(driverId: string, id: string, dto: WorkSessionVersionDto, deleted: boolean) {
    const { clientMutationId, expectedVersion } = WorkSessionVersionSchema.parse(dto);
    const kind = deleted ? WorkSessionMutation.Delete : WorkSessionMutation.Restore;
    return this.execute(driverId, kind, clientMutationId, { id, expectedVersion }, async (tx) => {
      const before = await findSession(tx, driverId, id);
      assertSessionVersion(before, expectedVersion);
      if (Boolean(before.deletedAt) === deleted) throw new ConflictException({ code: 'SESSION_STATE_CONFLICT' });
      if (!deleted && !before.endedAt && await tx.session.findFirst({ where: { driverId, endedAt: null, deletedAt: null } })) {
        throw new ConflictException({ code: 'SESSION_ALREADY_OPEN' });
      }
      const after = await tx.session.update({ where: { id }, data: { deletedAt: deleted ? new Date() : null, version: { increment: 1 } } });
      await recordSessionChange(tx, after, deleted ? WorkSessionChange.Deleted : WorkSessionChange.Restored, before);
      await this.refresh(tx, after, before);
      return after;
    });
  }
  private async refresh(tx: Prisma.TransactionClient, after: Session, before: Session | null = null): Promise<void> {
    const intervals = [before, after].flatMap((row) => row?.endedAt ? [{ startedAt: row.startedAt, endedAt: row.endedAt }] : []);
    if (intervals.length) await this.aggregates.refreshIntervals(after.driverId, intervals, tx);
  }
}
