import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ListSessionsSchema, WorkSessionHistoryQuerySchema } from '@ehsbha/api-contracts';
import { WorkSessionView } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

export async function verifyWorkSessions(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, SessionsService, AggregatesService] }).compile();
  const sessions = module.get(SessionsService), suffix = randomUUID();
  const owner = (label: string) => database.user.create({ data: { phone: `work-${label}-${suffix}`, passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Work session verification' } } }, include: { driver: true } });
  const first = await owner('owner'), second = await owner('other');
  assert(first.driver && second.driver);
  const driverId = first.driver.id, otherId = second.driver.id;
  const source = await database.appSource.create({ data: { code: `work-${suffix}`, name: 'Work verification', isSystem: false } });
  const binding = await database.driverApp.create({ data: { driverId, appSourceId: source.id, commissionPct: 0 } });
  const startedAt = new Date('2026-09-15T08:00:00Z'), endedAt = new Date('2026-09-15T10:00:00Z');
  const state = async () => ({ rows: await database.session.findMany({ where: { driverId }, orderBy: { id: 'asc' } }),
    history: await database.sessionRevision.findMany({ where: { driverId }, orderBy: { id: 'asc' } }),
    receipts: await database.driverMutationReceipt.findMany({ where: { driverId }, orderBy: { clientMutationId: 'asc' } }),
    daily: await database.dailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } }),
    apps: await database.appDailyAggregate.findMany({ where: { driverId }, orderBy: { date: 'asc' } }) });
  try {
    assert.equal(await sessions.getOpen(driverId), null);
    const startKey = randomUUID();
    const open = await sessions.start(driverId, { clientMutationId: startKey, startedAt });
    assert.equal(open.driverAppId, null, 'Overall work does not invent a platform');
    assert.equal((await sessions.start(driverId, { clientMutationId: startKey, startedAt })).id, open.id);
    await assert.rejects(sessions.start(driverId, { clientMutationId: randomUUID(), startedAt }), ConflictException);
    await assert.rejects(sessions.end(otherId, open.id, { clientMutationId: randomUUID(), expectedVersion: 1, endedAt }), NotFoundException);
    await assert.rejects(sessions.start(otherId, { clientMutationId: randomUUID(), driverAppId: binding.id, startedAt }), NotFoundException);
    const ended = await sessions.end(driverId, open.id, { clientMutationId: randomUUID(), expectedVersion: open.version, endedAt });
    assert.equal(ended.version, 2); assert.equal(ended.activeMinutes, 120);
    const legacy = await sessions.start(driverId, { clientMutationId: randomUUID(), driverAppId: binding.id, startedAt: new Date('2026-09-15T08:30Z') });
    await sessions.end(driverId, legacy.id, { clientMutationId: randomUUID(), expectedVersion: 1, endedAt: new Date('2026-09-15T09:00Z') });
    let daily = await database.dailyAggregate.findFirstOrThrow({ where: { driverId } });
    assert.equal(daily.onlineMinutes, 120, 'Overlap counts once');
    assert.equal((await database.appDailyAggregate.findFirstOrThrow({ where: { driverId, driverAppId: binding.id } })).onlineMinutes, 30, 'Overall shift is not attributed to a platform');
    const corrected = await sessions.correct(driverId, ended.id, { clientMutationId: randomUUID(), expectedVersion: 2, startedAt, endedAt: new Date('2026-09-15T11:00Z') });
    const beforeReplay = await state();
    const replayedStart = await sessions.start(driverId, { clientMutationId: startKey, startedAt });
    assert.equal(replayedStart.version, corrected.version); assert(replayedStart.endedAt);
    assert.deepEqual(await state(), beforeReplay, 'A replay does not reopen or rewrite a corrected session');
    await assert.rejects(sessions.correct(driverId, ended.id, { clientMutationId: randomUUID(), expectedVersion: 2, startedAt, endedAt }), ConflictException);
    const deleteKey = randomUUID();
    const removed = await sessions.remove(driverId, ended.id, { clientMutationId: deleteKey, expectedVersion: corrected.version });
    daily = await database.dailyAggregate.findFirstOrThrow({ where: { driverId } }); assert.equal(daily.onlineMinutes, 30);
    const restored = await sessions.restore(driverId, ended.id, { clientMutationId: randomUUID(), expectedVersion: removed.version });
    assert.equal((await sessions.remove(driverId, ended.id, { clientMutationId: deleteKey, expectedVersion: corrected.version })).version, restored.version);
    assert.equal((await database.dailyAggregate.findFirstOrThrow({ where: { driverId } })).onlineMinutes, 180);
    assert.equal((await sessions.history(driverId, ended.id, WorkSessionHistoryQuerySchema.parse({}))).items.length, 5);
    await assert.rejects(sessions.history(otherId, ended.id, WorkSessionHistoryQuerySchema.parse({})), NotFoundException);
    await assert.rejects(sessions.get(otherId, ended.id), NotFoundException);

    const createKey = randomUUID();
    const missed = await sessions.create(driverId, { clientMutationId: createKey, startedAt, endedAt });
    assert.equal((await sessions.create(driverId, { clientMutationId: createKey, startedAt, endedAt })).id, missed.id);
    await assert.rejects(sessions.create(driverId, { clientMutationId: createKey, startedAt, endedAt: new Date('2026-09-15T12:00Z') }), ConflictException);
    const page = await sessions.list(driverId, ListSessionsSchema.parse({ limit: 1 })); assert(page.nextCursor);
    const next = await sessions.list(driverId, ListSessionsSchema.parse({ limit: 1, cursor: page.nextCursor }));
    assert.notEqual(page.items[0].id, next.items[0].id, 'Tied timestamps page by ID');
    await assert.rejects(sessions.list(otherId, ListSessionsSchema.parse({ limit: 1, cursor: page.nextCursor })), BadRequestException);
    await assert.rejects(sessions.list(driverId, ListSessionsSchema.parse({ limit: 1, cursor: page.nextCursor, view: WorkSessionView.Deleted })), BadRequestException);
    await assert.rejects(sessions.start(driverId, { clientMutationId: randomUUID(), startedAt: new Date(Date.now() + 3_600_000) }), BadRequestException);
    await assert.rejects(sessions.create(driverId, { clientMutationId: randomUUID(), startedAt, endedAt: new Date('2026-09-23T08:00Z') }));

    const raced = await Promise.allSettled([sessions.start(otherId, { clientMutationId: randomUUID(), startedAt }), sessions.start(otherId, { clientMutationId: randomUUID(), startedAt })]);
    assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1);
    const current = await sessions.getOpen(otherId); assert(current);
    const cancelled = await sessions.remove(otherId, current.id, { clientMutationId: randomUUID(), expectedVersion: current.version });
    assert.equal(await sessions.getOpen(otherId), null);
    const replacement = await sessions.start(otherId, { clientMutationId: randomUUID(), startedAt });
    await assert.rejects(sessions.restore(otherId, cancelled.id, { clientMutationId: randomUUID(), expectedVersion: cancelled.version }), ConflictException);
    await sessions.remove(otherId, replacement.id, { clientMutationId: randomUUID(), expectedVersion: replacement.version });
    assert.equal((await sessions.restore(otherId, cancelled.id, { clientMutationId: randomUUID(), expectedVersion: cancelled.version })).endedAt, null);

    await database.$executeRawUnsafe(`CREATE FUNCTION verify_session_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.client_mutation_id LIKE 'work-rollback-%' THEN RAISE EXCEPTION 'private injected receipt failure'; END IF; RETURN NEW; END $$`);
    await database.$executeRawUnsafe('CREATE TRIGGER verify_session_receipt_failure AFTER INSERT ON driver_mutation_receipts FOR EACH ROW EXECUTE FUNCTION verify_session_receipt_failure()');
    const beforeFailure = await state();
    await assert.rejects(sessions.correct(driverId, missed.id, { clientMutationId: `work-rollback-${randomUUID()}`, expectedVersion: missed.version, startedAt, endedAt: new Date('2026-09-15T12:00Z') }));
    assert.deepEqual(await state(), beforeFailure, 'Receipt failure rolls back correction, history, and projections');
    const times: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const begin = performance.now(); await sessions.create(driverId, { clientMutationId: randomUUID(), startedAt, endedAt }); times.push(performance.now() - begin);
    }
    times.sort((a, b) => a - b); assert(times[18] < 500);
    console.info(`Work-session write p95: ${times[18].toFixed(2)}ms; 20 committed records with history, receipts, and projections`);
  } finally {
    await database.$executeRawUnsafe('DROP TRIGGER IF EXISTS verify_session_receipt_failure ON driver_mutation_receipts');
    await database.$executeRawUnsafe('DROP FUNCTION IF EXISTS verify_session_receipt_failure()');
    await database.trip.deleteMany({ where: { driverId } });
    await database.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
    await database.appSource.delete({ where: { id: source.id } });
    await module.close();
  }
}
