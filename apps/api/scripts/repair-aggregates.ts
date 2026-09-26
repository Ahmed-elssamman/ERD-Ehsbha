import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { aggregateRepairDates, aggregateRepairPeriods, repairDriverAggregates } from '../src/modules/aggregates/aggregate-repair';
import { AGGREGATE_DRIVER_PAGE_SIZE, FINANCIAL_PROJECTION_VERSION } from '../src/modules/aggregates/aggregate.control';
import { ReportingCalendar } from '@prisma/client';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const driverArgs = args.filter((arg) => arg.startsWith('--driver='));
  if (args.some((arg) => arg !== '--apply' && !arg.startsWith('--driver=')) || driverArgs.length > 1
    || args.filter((arg) => arg === '--apply').length > 1 || driverArgs.some((arg) => !arg.slice('--driver='.length).trim())) {
    process.stderr.write('Usage: repair-aggregates [--apply] [--driver=ID]. An explicit driver ID must be nonempty.\n');
    process.exitCode = 1;
    return;
  }
  const apply = args.includes('--apply');
  const driverId = args.find((arg) => arg.startsWith('--driver='))?.slice('--driver='.length) ?? '';
  const database = new PrismaService();
  const aggregates = new AggregatesService(database);
  let cursor = '';
  let drivers = 0;
  let days = 0;
  let periods = 0;
  let pendingCalendars = 0;
  let pendingFinancialProjections = 0;
  try {
    while (true) {
      const page = await database.driver.findMany({ where: driverId ? { id: driverId } : {}, select: { id: true, reportingCalendar: true, financialProjectionVersion: true }, orderBy: { id: 'asc' },
        take: AGGREGATE_DRIVER_PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!page.length) break;
      for (const driver of page) {
        if (driver.reportingCalendar === ReportingCalendar.UTC) pendingCalendars += 1;
        if (driver.financialProjectionVersion !== FINANCIAL_PROJECTION_VERSION) pendingFinancialProjections += 1;
        const counts = apply ? await repairDriverAggregates(database, aggregates, driver.id) : {
          days: (await aggregateRepairDates(database, driver.id)).length,
          periods: (await aggregateRepairPeriods(database, driver.id)).length,
        };
        days += counts.days;
        periods += counts.periods;
        drivers += 1;
      }
      cursor = page[page.length - 1].id;
    }
    if (driverId && drivers === 0) throw new Error('Requested driver does not exist');
    process.stdout.write(JSON.stringify({ mode: apply ? 'applied' : 'preview', drivers, days, periods, pendingCalendars, pendingFinancialProjections }) + '\n');
  } finally { await database.$disconnect(); }
}
void main().catch(() => { process.stderr.write('Aggregate repair failed. Previously completed days are safe to retry; inspect database health and record validation.\n'); process.exitCode = 1; });
