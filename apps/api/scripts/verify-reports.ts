import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { reportContentSchema, reportReadyDataSchema, ReportListQuerySchema, ReportHistoryQuerySchema } from '@ehsbha/api-contracts';
import { calendarDateValue, ReportPeriod, reportPeriodRange } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ReportPreferencesService } from '../src/modules/reports/report-preferences.service';
import { ReportDeliveryService } from '../src/modules/reports/report-delivery.service';
import { readReportCash } from '../src/modules/reports/report-cash-reader';

export async function verifyReports(database: PrismaClient): Promise<void> {
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, AggregatesService, ReportsService, ReportPreferencesService, ReportDeliveryService] }).compile();
  const reports = module.get(ReportsService), prefs = module.get(ReportPreferencesService), delivery = module.get(ReportDeliveryService), aggregates = module.get(AggregatesService);
  const suffix = randomUUID();
  const owner = (name: string) => database.user.create({ data: { phone: `reports-${name}-${suffix}`, locale: 'en', passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Report verification' } } }, include: { driver: true } });
  const user = await owner('owner'), other = await owner('other');
  assert(user.driver && other.driver);
  const driverId = user.driver.id, otherId = other.driver.id;
  const source = await database.appSource.create({ data: { code: `report-${suffix}`, name: 'Report platform', isSystem: false } });
  const item = await database.maintenanceItem.create({ data: { code: `report-${suffix}`, name: 'Report service', defaultIntervalKm: 10000, defaultIntervalDays: 180 } });
  try {
    const vehicle = await database.vehicle.create({ data: { driverId, type: 'CAR', fuelType: 'PETROL_92', make: 'Recorded', model: 'vehicle', odometerMeters: 0 } });
    const app = await database.driverApp.create({ data: { driverId, appSourceId: source.id, commissionPct: 0 } });
    const trip = await database.trip.create({ data: { driverId, vehicleId: vehicle.id, driverAppId: app.id, startedAt: new Date('2026-08-31T21:00Z'), endedAt: new Date('2026-08-31T22:00Z'),
      grossPiastres: 12000, commissionPiastres: 2000, earningsPiastres: 10000n, totalKmMeters: 12000, paidKmMeters: 10000, emptyKmMeters: 2000, tollPiastres: 500, parkingPiastres: 200 } });
    const fuelPayment = await database.expense.create({ data: { driverId, vehicleId: vehicle.id, category: 'OTHER', amountPiastres: 2000, dateTime: new Date('2026-09-02T08:00Z') } });
    await database.fuelLog.create({ data: { driverId, vehicleId: vehicle.id, dateTime: new Date('2026-09-01T08:00Z'), totalPiastres: 2000, linkedExpenseId: fuelPayment.id } });
    await database.fuelLog.create({ data: { driverId, vehicleId: vehicle.id, dateTime: new Date('2026-09-01T08:00Z'), totalPiastres: 1000 } });
    const servicePayment = await database.expense.create({ data: { driverId, vehicleId: vehicle.id, category: 'OTHER', amountPiastres: 3000, dateTime: new Date('2026-09-07T08:00Z') } });
    await database.maintenanceRecord.create({ data: { driverId, vehicleId: vehicle.id, maintenanceItemId: item.id, performedAt: new Date('2026-09-03T08:00Z'), costPiastres: 3000, odometerMeters: 0, linkedExpenseId: servicePayment.id } });
    await database.expense.create({ data: { driverId, category: 'OTHER', amountPiastres: 100, dateTime: new Date('2026-09-01T10:00Z') } });
    await database.expense.create({ data: { driverId, vehicleId: vehicle.id, category: 'TOLL', linkedTripId: trip.id, amountPiastres: 500, dateTime: new Date('2026-09-02T09:00Z') } });
    await database.session.create({ data: { driverId, startedAt: new Date('2026-08-31T20:30Z'), endedAt: new Date('2026-08-31T22:30Z'), activeMinutes: 120 } });
    await aggregates.ensureCalendar(driverId);
    for (const date of ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-07']) await aggregates.rebuildDay(driverId, calendarDateValue(date));
    const create = { period: ReportPeriod.Weekly, date: '2026-09-01', clientMutationId: randomUUID() };
    const captured = await reports.create(driverId, create), content = captured.content;
    assert.equal(content.startsOn, '2026-08-31'); assert.equal(content.endsOn, '2026-09-06');
    assert.equal(content.totals.tripCount, 1); assert.equal(content.totals.takeHomePiastres, 10000);
    assert.equal(content.totals.totalCostsPiastres, 3800); assert.equal(content.totals.netPiastres, 6200);
    assert.equal(content.totals.workMinutes, 120); assert.equal(content.totals.netPerHourPiastres, 3100);
    assert.equal(content.totals.netPerKmPiastres, 517); assert.equal(content.totals.grossPiastres, 12000);
    assert.equal(content.fuelPurchasesPiastres, 3000); assert.equal(content.maintenanceServicesPiastres, 3000);
    assert.equal(content.vehicleCosts?.[0].totalPiastres, 3700); assert.equal(content.unassignedCostsPiastres, 100);
    assert.equal(content.platforms?.[0].contributionPiastres, 9300);
    assert.equal(content.previous.totals.netPerHourPiastres, null); assert.equal(content.days.length, 7);
    assert(!JSON.stringify(captured).includes('driverId'));
    assert.deepEqual(await reports.create(driverId, create), captured);
    assert.equal((await reports.create(driverId, { ...create, date: '2026-09-06', clientMutationId: randomUUID() })).id, captured.id);
    await assert.rejects(reports.create(driverId, { ...create, date: '2026-08-01' }), ConflictException);
    await assert.rejects(reports.create(driverId, { ...create, date: '2099-01-01', clientMutationId: randomUUID() }), BadRequestException);
    await assert.rejects(reports.get(otherId, captured.id), NotFoundException);
    await assert.rejects(reports.revision(otherId, captured.id, 1), NotFoundException);
    await assert.rejects(reports.history(otherId, captured.id, ReportHistoryQuerySchema.parse({})), NotFoundException);
    await assert.rejects(reports.revise(otherId, captured.id, { expectedVersion: 1, clientMutationId: randomUUID() }), NotFoundException);
    const cash = await database.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Pacific/Honolulu'"); return readReportCash(tx, driverId, reportPeriodRange(ReportPeriod.Weekly, create.date)); });
    assert.equal(cash.totalPiastres, 3800); assert(cash.largestCosts.every((cost) => cost.date >= '2026-08-31' && cost.date <= '2026-09-06'));

    await database.trip.update({ where: { id: trip.id }, data: { grossPiastres: null, commissionPiastres: null, earningsPiastres: 1000n } });
    await aggregates.rebuildDay(driverId, calendarDateValue('2026-09-01'));
    assert.deepEqual((await reports.get(driverId, captured.id)).content, content, 'Source correction does not mutate the saved snapshot');
    const revisionCommand = { expectedVersion: 1, clientMutationId: randomUUID() };
    const revised = await reports.revise(driverId, captured.id, revisionCommand);
    assert.equal(revised.version, 2); assert.equal(revised.content.totals.netPiastres, -2800); assert.equal(revised.content.totals.grossPiastres, null);
    assert.equal(revised.content.totals.commissionPiastres, null); assert.equal(revised.content.totals.netPerHourPiastres, -1400);
    assert.deepEqual((await reports.revision(driverId, captured.id, 1)).content, content);
    await assert.rejects(reports.revise(driverId, captured.id, { expectedVersion: 1, clientMutationId: randomUUID() }), ConflictException);
    const races = await Promise.allSettled([1, 2].map(() => reports.revise(driverId, captured.id, { expectedVersion: 2, clientMutationId: randomUUID() })));
    assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await reports.revise(driverId, captured.id, revisionCommand)).version, 3);
    assert.equal((await reports.create(driverId, create)).version, 3, 'A late create replay returns current state');
    const history = await reports.history(driverId, captured.id, ReportHistoryQuerySchema.parse({ limit: 1 })); assert(history.nextCursor);
    assert.equal(history.items[0].version, 3);
    assert.equal((await reports.history(driverId, captured.id, ReportHistoryQuerySchema.parse({ limit: 1, cursor: history.nextCursor }))).items[0].version, 2);
    const secondReport = await reports.create(driverId, { period: ReportPeriod.Monthly, date: '2026-08-01', clientMutationId: randomUUID() });
    await assert.rejects(reports.history(driverId, secondReport.id, ReportHistoryQuerySchema.parse({ cursor: history.nextCursor })), BadRequestException);
    const page = await reports.list(driverId, ReportListQuerySchema.parse({ limit: 1 })); assert(page.nextCursor);
    await assert.rejects(reports.list(otherId, ReportListQuerySchema.parse({ cursor: page.nextCursor })), BadRequestException);
    assert(!('content' in page.items[0]));

    const initial = await prefs.get(driverId), { version, ...fields } = initial;
    const disabled = { ...fields, weeklyEnabled: false, expectedVersion: version, clientMutationId: randomUUID() };
    await prefs.update(driverId, disabled);
    assert.equal(await delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-07T09:00Z')), null);
    await prefs.update(driverId, { ...fields, expectedVersion: 1, clientMutationId: randomUUID() });
    assert.equal((await prefs.update(driverId, disabled)).version, 2);
    assert.equal(await delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-07T05:59Z')), null);
    const delivered = await Promise.all([delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-07T06:00Z')), delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-07T06:00Z'))]);
    assert(delivered[0]); assert.equal(delivered[0], delivered[1]);
    const notification = await database.notification.findUniqueOrThrow({ where: { id: delivered[0] } });
    const data = reportReadyDataSchema.parse(notification.data); assert.equal(data.version, 3); assert.equal(data.reportId, captured.id);
    assert.equal(await delivery.deliver(otherId, ReportPeriod.Monthly, new Date('2026-09-01T09:00Z')), null);
    assert.equal(await database.driverReport.count({ where: { driverId: otherId } }), 0);
    await reports.revise(driverId, captured.id, { expectedVersion: 3, clientMutationId: randomUUID() });
    assert.equal(await delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-08T09:00Z')), delivered[0]);
    assert.equal((await reports.revision(driverId, data.reportId, data.version)).version, 3);
    await database.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    assert.equal(await delivery.deliver(driverId, ReportPeriod.Weekly, new Date('2026-09-14T09:00Z')), null);
    await database.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });

    const beforeFailure = await reports.get(driverId, captured.id), failedKey = randomUUID();
    await database.$executeRawUnsafe(`CREATE FUNCTION fail_report_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.driver_id = '${driverId}' THEN RAISE EXCEPTION 'report revision verification'; END IF; RETURN NEW; END $$`);
    await database.$executeRawUnsafe('CREATE TRIGGER fail_report_revision BEFORE INSERT ON report_revisions FOR EACH ROW EXECUTE FUNCTION fail_report_revision()');
    try { await assert.rejects(reports.revise(driverId, captured.id, { expectedVersion: beforeFailure.version, clientMutationId: failedKey })); }
    finally { await database.$executeRawUnsafe('DROP TRIGGER fail_report_revision ON report_revisions'); await database.$executeRawUnsafe('DROP FUNCTION fail_report_revision()'); }
    assert.deepEqual(await reports.get(driverId, captured.id), beforeFailure);
    assert.equal(await database.driverMutationReceipt.count({ where: { driverId, clientMutationId: failedKey } }), 0);
    await database.dailyAggregate.updateMany({ where: { driverId, date: calendarDateValue('2026-09-01') }, data: { fuelPiastres: { increment: 1 } } });
    await assert.rejects(reports.revise(driverId, captured.id, { expectedVersion: beforeFailure.version, clientMutationId: randomUUID() }), RangeError);
    await aggregates.rebuildDay(driverId, calendarDateValue('2026-09-01'));

    const vehicles = Array.from({ length: 201 }, (_, index) => ({ id: `report-vehicle-${suffix}-${index}`, driverId, type: 'CAR' as const, fuelType: 'PETROL_92' as const, odometerMeters: 0 }));
    await database.vehicle.createMany({ data: vehicles });
    await database.expense.createMany({ data: vehicles.map((row) => ({ driverId, vehicleId: row.id, category: 'OTHER' as const, amountPiastres: 1, dateTime: new Date('2026-09-04T08:00Z') })) });
    await database.expense.createMany({ data: Array.from({ length: 1001 }, () => ({ driverId, category: 'OTHER' as const, amountPiastres: 1, dateTime: new Date('2026-09-04T08:00Z') })) });
    await aggregates.rebuildDay(driverId, calendarDateValue('2026-09-04'));
    const start = performance.now(), large = await reports.revise(driverId, captured.id, { expectedVersion: beforeFailure.version, clientMutationId: randomUUID() }), elapsed = performance.now() - start;
    assert.equal(large.content.vehicleCosts, null); assert.equal(large.content.totals.totalCostsPiastres, 5002); assert.equal(large.content.unassignedCostsPiastres, 1101);
    assert.equal(large.content.largestCosts.length, 10); assert.equal(large.content.largestCosts[0].amountPiastres, 2000);
    assert(elapsed < 1500, 'Report capture stays below 1.5 seconds over 1,200+ ledger entries');
    reportContentSchema.parse(large.content);
    process.stdout.write(`Report capture: ${elapsed.toFixed(2)}ms over 1,200+ cost entries, complete totals and omitted oversized vehicle breakdown\n`);
  } finally {
    await database.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await database.appSource.delete({ where: { id: source.id } }); await database.maintenanceItem.delete({ where: { id: item.id } }); await module.close();
  }
}
