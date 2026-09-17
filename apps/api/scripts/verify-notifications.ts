import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentDailyDigestDataSchema, ListNotificationsSchema } from '@ehsbha/api-contracts';
import { DevicePlatform, DigestFrequency, NotificationKind } from '@ehsbha/shared-types';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { NotificationPreferencesService } from '../src/modules/notifications/notification-preferences.service';
import { DailyDigestService } from '../src/modules/notifications/daily-digest.service';
import { readDigestSnapshot } from '../src/modules/notifications/digest-insights';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

async function verifyLegacyMigration(database: PrismaClient): Promise<void> {
  const migration = readFileSync(resolve(__dirname, '../prisma/migrations/20260924000000_notification_delivery/migration.sql'), 'utf8');
  await database.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE SCHEMA notification_migration_verification');
    await tx.$executeRawUnsafe('SET LOCAL search_path TO notification_migration_verification');
    await tx.$executeRawUnsafe('CREATE TABLE drivers (id TEXT PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TABLE notifications (id TEXT PRIMARY KEY, driver_id TEXT, data JSONB, sent_at TIMESTAMP, read_at TIMESTAMP)');
    await tx.$executeRawUnsafe("INSERT INTO drivers VALUES ('one')");
    await tx.$executeRawUnsafe(`INSERT INTO notifications VALUES
      ('first','one','{"kind":"DAILY_DIGEST"}','2026-09-17 21:10:00','2026-09-17 21:20:00'),
      ('duplicate','one','{"kind":"DAILY_DIGEST"}','2026-09-17 21:30:00',NULL),
      ('general','one',NULL,'2026-09-17 20:00:00',NULL)`);
    for (const statement of migration.split(';').filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    const rows = await tx.$queryRaw<Array<{ id: string; event_key: string | null; event_date: Date | null; sent_at: Date; read_at: Date | null }>>`SELECT * FROM notifications ORDER BY id`;
    assert.equal(rows.length, 3);
    assert.equal(rows.find((row) => row.id === 'first')?.event_key, 'daily-digest:2026-09-18');
    assert.equal(rows.find((row) => row.id === 'duplicate')?.event_key, null);
    assert.equal(rows.find((row) => row.id === 'first')?.sent_at.toISOString(), '2026-09-17T21:10:00.000Z');
    assert.equal(rows.find((row) => row.id === 'first')?.read_at?.toISOString(), '2026-09-17T21:20:00.000Z');
    await tx.$executeRawUnsafe('DROP SCHEMA notification_migration_verification CASCADE');
  });
}

export async function verifyNotifications(database: PrismaClient): Promise<void> {
  await verifyLegacyMigration(database);
  const module = await Test.createTestingModule({ providers: [{ provide: PrismaService, useValue: database }, NotificationsService, NotificationPreferencesService, DailyDigestService, AggregatesService] }).compile();
  const inbox = module.get(NotificationsService), preferences = module.get(NotificationPreferencesService), digest = module.get(DailyDigestService), aggregates = module.get(AggregatesService);
  const suffix = randomUUID();
  const owner = (label: string) => database.user.create({ data: { phone: `notification-${label}-${suffix}`, locale: 'en', passwordHash: 'unusable-test-password', driver: { create: { displayName: 'Notification verification' } } }, include: { driver: true } });
  const first = await owner('owner'), second = await owner('other');
  assert(first.driver && second.driver);
  const driverId = first.driver.id, otherId = second.driver.id;
  const source = await database.appSource.create({ data: { code: `notification-${suffix}`, name: 'Recorded app', isSystem: false } });
  try {
    await aggregates.ensureCalendar(driverId); await aggregates.ensureCalendar(otherId);
    const initial = await preferences.get(driverId), { version, ...fields } = initial;
    assert.equal(version, 0);
    const command = { ...fields, digestEnabled: false, expectedVersion: 0, clientMutationId: randomUUID() };
    const saved = await preferences.update(driverId, command); assert.equal(saved.version, 1);
    await assert.rejects(preferences.update(driverId, { ...command, digestEnabled: true }), ConflictException);
    const races = await Promise.allSettled([510, 600].map((deliveryMinute) => preferences.update(driverId, { ...fields, deliveryMinute, expectedVersion: 1, clientMutationId: randomUUID() })));
    assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
    const current = await preferences.get(driverId); assert.equal(current.version, 2);
    assert.deepEqual(await preferences.update(driverId, command), current, 'Late replay returns current settings without undoing a later change');
    assert.equal((await preferences.get(otherId)).version, 0);
    await assert.rejects(database.notificationPreferences.update({ where: { driverId }, data: { deliveryMinute: 1380, digestEnabled: true } }));
    const rollback = { ...fields, expectedVersion: 2, clientMutationId: randomUUID() };
    await database.$executeRawUnsafe(`CREATE FUNCTION fail_notification_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.driver_id = '${driverId}' THEN RAISE EXCEPTION 'receipt verification'; END IF; RETURN NEW; END $$`);
    await database.$executeRawUnsafe('CREATE TRIGGER fail_notification_receipt BEFORE INSERT ON driver_mutation_receipts FOR EACH ROW EXECUTE FUNCTION fail_notification_receipt()');
    try { await assert.rejects(preferences.update(driverId, rollback)); assert.deepEqual(await preferences.get(driverId), current); }
    finally { await database.$executeRawUnsafe('DROP TRIGGER fail_notification_receipt ON driver_mutation_receipts'); await database.$executeRawUnsafe('DROP FUNCTION fail_notification_receipt()'); }
    assert.equal(await database.driverMutationReceipt.count({ where: { driverId, clientMutationId: rollback.clientMutationId } }), 0);

    const sentAt = new Date('2026-09-01T08:00Z');
    await database.notification.createMany({ data: Array.from({ length: 1001 }, (_, index) => ({ id: `notification-${suffix}-${String(index).padStart(4, '0')}`, driverId, title: 'Inbox verification', body: 'Recorded message', channel: 'INAPP', sentAt })) });
    const page = await inbox.list(driverId, ListNotificationsSchema.parse({ limit: 100 })); assert(page.nextCursor);
    const next = await inbox.list(driverId, ListNotificationsSchema.parse({ limit: 100, cursor: page.nextCursor }));
    assert.equal(new Set([...page.items, ...next.items].map((item) => item.id)).size, 200);
    await assert.rejects(inbox.list(otherId, ListNotificationsSchema.parse({ cursor: page.nextCursor })), BadRequestException);
    await assert.rejects(inbox.list(driverId, ListNotificationsSchema.parse({ cursor: 'broken' })), BadRequestException);
    const marked = await inbox.markRead(driverId, page.items[0].id);
    assert.equal((await inbox.markRead(driverId, page.items[0].id)).readAt, marked.readAt);
    await assert.rejects(inbox.markRead(otherId, page.items[0].id), NotFoundException);
    const token = { token: `verification-device-${suffix}`, platform: DevicePlatform.Web };
    await inbox.registerDevice(first.id, token); await inbox.registerDevice(first.id, token);
    await assert.rejects(inbox.registerDevice(second.id, token), ConflictException);
    const competingToken = { token: `competing-device-${suffix}`, platform: DevicePlatform.Web };
    const registrations = await Promise.allSettled([inbox.registerDevice(first.id, competingToken), inbox.registerDevice(second.id, competingToken)]);
    assert.equal(registrations.filter((result) => result.status === 'fulfilled').length, 1, 'A simultaneous registration cannot return another account’s token record');
    const rejectedRegistration = registrations.find((result) => result.status === 'rejected');
    assert(rejectedRegistration?.status === 'rejected' && rejectedRegistration.reason instanceof ConflictException);
    const times: number[] = [];
    for (let index = 0; index < 10; index++) { const start = performance.now(); await inbox.list(driverId, ListNotificationsSchema.parse({ limit: 100 })); times.push(performance.now() - start); }
    assert(times.sort((a, b) => a - b)[9] < 1000, 'Inbox remains below one second over 1,001 records');

    const now = new Date('2026-09-17T09:00Z');
    assert.equal(await digest.generateForDriver(otherId, false, now), null, 'Empty history stays missing');
    await database.goal.create({ data: { driverId, period: 'MONTHLY', targetPiastres: 100000, startsOn: new Date('2026-09-10'), endsOn: new Date('2026-10-09') } });
    await database.dailyAggregate.createMany({ data: [{ driverId, date: new Date('2026-09-05'), netProfitPiastres: 900000 }, { driverId, date: new Date('2026-09-16'), netProfitPiastres: 8000, emptyKmMeters: 1000, totalKmMeters: 5000 }] });
    const vehicle = await database.vehicle.create({ data: { driverId, type: 'CAR', fuelType: 'PETROL_92' } });
    const app = await database.driverApp.create({ data: { driverId, appSourceId: source.id, commissionPct: 0 } });
    const area = await database.area.create({ data: { driverId, name: 'Lower recorded rate' } });
    const higher = await database.area.create({ data: { driverId, name: 'Higher recorded rate' } });
    const trip = { driverId, vehicleId: vehicle.id, driverAppId: app.id, startedAt: new Date('2026-09-10T07:00Z'), endedAt: new Date('2026-09-10T07:30Z'),
      earningsPiastres: 10000n, paidKmMeters: 5000, emptyKmMeters: 1000, totalKmMeters: 6000 };
    await database.trip.createMany({ data: Array.from({ length: 10 }, (_, index) => ({ ...trip, areaId: index < 5 ? area.id : higher.id, earningsPiastres: index < 5 ? 10000n : 20000n })) });
    const snapshot = currentDailyDigestDataSchema.parse(await database.$transaction((tx) => readDigestSnapshot(tx, driverId, now)));
    assert.equal(snapshot.insights.goalStartDate, '2026-09-10'); assert.equal(snapshot.insights.remainingGoalDays, 23);
    assert.equal(snapshot.insights.earnedBeforeTodayPiastres, 8000); assert.equal(snapshot.insights.todayTargetPiastres, 4000);
    assert.equal(snapshot.insights.bestStartHour?.earningsPerTripHourPiastres, 30000);
    assert.equal(snapshot.insights.highestAppTotal?.earningsPiastres, 150000);
    assert.equal(snapshot.insights.lowerAreaRate?.tripCount, 5); assert.equal(snapshot.insights.lowerAreaRate?.earningsPerPaidKmPiastres, 2000);
    assert.equal(snapshot.insights.yesterdayEmptyRatioBp, 2000);
    await database.$executeRawUnsafe(`CREATE FUNCTION fail_digest_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.driver_id = '${driverId}' THEN RAISE EXCEPTION 'digest verification'; END IF; RETURN NEW; END $$`);
    await database.$executeRawUnsafe('CREATE TRIGGER fail_digest_capture AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_digest_capture()');
    try { await assert.rejects(digest.generateForDriver(driverId, false, now)); assert.equal(await database.notification.count({ where: { driverId, eventKey: 'daily-digest:2026-09-17' } }), 0); }
    finally { await database.$executeRawUnsafe('DROP TRIGGER fail_digest_capture ON notifications'); await database.$executeRawUnsafe('DROP FUNCTION fail_digest_capture()'); }
    const concurrent = await Promise.all([digest.generateForDriver(driverId, false, now), digest.generateForDriver(driverId, true, now), digest.generateForDriver(driverId, false, now)]);
    assert(concurrent[0]); assert.equal(new Set(concurrent).size, 1);
    const stored = await database.notification.findUniqueOrThrow({ where: { id: concurrent[0] } });
    assert.equal(stored.title, 'Your work digest'); assert.equal(stored.kind, NotificationKind.DailyDigest);
    assert.equal(await database.notification.count({ where: { driverId, eventKey: 'daily-digest:2026-09-17' } }), 1);
    const active = await preferences.get(driverId);
    await preferences.update(driverId, { ...fields, digestFrequency: DigestFrequency.Weekly, expectedVersion: active.version, clientMutationId: randomUUID() });
    assert.equal(await digest.generateForDriver(driverId, true, new Date('2026-09-18T09:00Z')), null);
    assert(await digest.generateForDriver(driverId, true, new Date('2026-09-24T09:00Z')));
    const enabled = await preferences.get(driverId);
    await preferences.update(driverId, { ...fields, digestEnabled: false, expectedVersion: enabled.version, clientMutationId: randomUUID() });
    assert.equal(await digest.generateForDriver(driverId, true, new Date('2026-09-25T09:00Z')), null);
    assert(await digest.generateForDriver(driverId, false, new Date('2026-09-25T09:00Z')));
    await database.user.update({ where: { id: first.id }, data: { locale: 'ar' } });
    const arabicId = await digest.generateForDriver(driverId, false, new Date('2026-09-26T09:00Z')); assert(arabicId);
    assert.equal((await database.notification.findUniqueOrThrow({ where: { id: arabicId } })).title, 'ملخص شغلك');
    await database.trip.createMany({ data: Array.from({ length: 9991 }, () => trip) });
    const boundedStart = performance.now();
    const bounded = await database.$transaction((tx) => readDigestSnapshot(tx, driverId, now), { timeout: 15000 });
    const boundedMs = performance.now() - boundedStart;
    assert(boundedMs < 2000, 'A 10,001-row detail scan remains bounded below two seconds locally');
    process.stdout.write(`Notification list p95: ${times[9].toFixed(2)}ms over 1,001 records; capped digest scan: ${boundedMs.toFixed(2)}ms over 10,001 trips\n`);
    assert.equal(bounded.sourceTripCount, null); assert.equal(bounded.insights.bestStartHour, null); assert.equal(bounded.insights.highestAppTotal, null);
    assert.equal(bounded.insights.yesterdayNetPiastres, 8000);
    await database.goal.deleteMany({ where: { driverId } });
    const limitId = await digest.generateForDriver(driverId, false, new Date('2026-09-27T09:00Z'));
    assert(limitId, 'A bounded-history notice must not be reported as insufficient history');
    const limitNotice = await database.notification.findUniqueOrThrow({ where: { id: limitId } });
    assert.equal(currentDailyDigestDataSchema.parse(limitNotice.data).sourceTripCount, null);
    assert(limitNotice.body.includes('حد التفاصيل المدعوم'));
    await database.user.update({ where: { id: first.id }, data: { status: 'SUSPENDED' } });
    assert.equal(await digest.generateForDriver(driverId, false, new Date('2026-09-28T09:00Z')), null);
  } finally {
    await database.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
    await database.appSource.delete({ where: { id: source.id } }); await module.close();
  }
}
