import { PrismaClient } from '@prisma/client';
import type { AggregatesService } from './aggregates.service';
import type { AggregateRepairCounts } from './aggregate.model';
import { aggregateRepairDates, aggregateRepairPeriods } from './aggregate-repair-query';
import { CALENDAR_REBUILD_TIMEOUT_MS } from './aggregate.control';
export { aggregateRepairDates, aggregateRepairPeriods } from './aggregate-repair-query';

export async function repairDriverAggregates(database: PrismaClient, aggregates: AggregatesService, driverId: string): Promise<AggregateRepairCounts> {
  await aggregates.ensureCalendar(driverId, CALENDAR_REBUILD_TIMEOUT_MS);
  const dates = await aggregateRepairDates(database, driverId);
  // Each day is atomic and resumable. Concurrent writes use the same driver lock.
  for (const date of dates) await aggregates.rebuildDay(driverId, date);
  // Repair orphan periods without creating artificial daily rows at their boundaries.
  const periods = await aggregateRepairPeriods(database, driverId);
  for (const period of periods) await aggregates.rebuildPeriod(driverId, period);
  return { days: dates.length, periods: periods.length };
}
