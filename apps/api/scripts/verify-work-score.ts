import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { businessDate } from '@ehsbha/shared-types';
import { driverScoreSchema } from '@ehsbha/api-contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScoreService } from '../src/modules/score/score.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { addDays } from '../src/common/utils/date';

export async function verifyWorkScore(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, ScoreService, AggregatesService] }).compile();
  const score = module.get(ScoreService);
  const owner = await database.user.create({ data: { phone: `score-${randomUUID()}`, passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Work score verification' } } }, include: { driver: true } });
  assert(owner.driver);
  const driverId = owner.driver.id, today = businessDate(new Date());
  try {
    assert.equal((await score.today(driverId)).overall, null);
    const legacy = await database.scoreSnapshot.create({ data: { driverId, date: today, overall: 88, efficiency: 80, profit: 80, safety: 100, consistency: 90 } });
    for (const days of [3, 2, 1, 0]) {
      const date = addDays(today, -days);
      const data = { netProfitPiastres: 1000, totalKmMeters: 1000, profitPerKmPiastres: 100, onlineMinutes: 60 };
      await database.dailyAggregate.upsert({ where: { driverId_date: { driverId, date } }, create: { driverId, date, ...data }, update: data });
    }
    const current = driverScoreSchema.parse(await score.today(driverId));
    assert.equal(current.algorithmVersion, 2); assert.equal(current.overall, 60);
    assert.equal('safety' in current, false);
    assert.equal((await score.history(driverId)).length, 1);
    assert.equal((await database.scoreSnapshot.findUniqueOrThrow({ where: { id: legacy.id } })).overall, 88);
    assert.equal(await database.scoreSnapshot.count({ where: { driverId, date: today } }), 2);
    await score.today(driverId);
    assert.equal(await database.scoreSnapshot.count({ where: { driverId, date: today } }), 2);
    assert.deepEqual(await score.history(`foreign-${randomUUID()}`), []);
    await database.dailyAggregate.delete({ where: { driverId_date: { driverId, date: addDays(today, -3) } } });
    assert.equal((await score.today(driverId)).overall, null);
    assert.equal((await score.history(driverId))[0].overall, null);
  } finally { await database.user.delete({ where: { id: owner.id } }); await module.close(); }
}
