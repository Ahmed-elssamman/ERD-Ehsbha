import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const APP_CATALOG = [
  { code: 'UBER', name: 'Uber', defaultCommissionPct: 25 },
  { code: 'INDRIVE', name: 'inDrive', defaultCommissionPct: 10 },
  { code: 'DIDI', name: 'DiDi', defaultCommissionPct: 20 },
  { code: 'CAREEM', name: 'Careem', defaultCommissionPct: 25 },
  { code: 'BOLT', name: 'Bolt', defaultCommissionPct: 20 },
  { code: 'TALABAT', name: 'Talabat (delivery)', defaultCommissionPct: 0 },
  { code: 'PRIVATE', name: 'Private clients', defaultCommissionPct: 0 },
];

const MAINTENANCE_ITEMS = [
  { code: 'ENGINE_OIL', name: 'Engine oil', defaultIntervalKm: 5_000, defaultIntervalDays: 180, appliesToCar: true, appliesToBike: true },
  { code: 'OIL_FILTER', name: 'Oil filter', defaultIntervalKm: 5_000, defaultIntervalDays: 180, appliesToCar: true, appliesToBike: true },
  { code: 'AIR_FILTER', name: 'Air filter', defaultIntervalKm: 15_000, defaultIntervalDays: 365, appliesToCar: true, appliesToBike: true },
  { code: 'BRAKES_FRONT', name: 'Front brakes', defaultIntervalKm: 30_000, defaultIntervalDays: 730, appliesToCar: true, appliesToBike: true },
  { code: 'BRAKES_REAR', name: 'Rear brakes', defaultIntervalKm: 40_000, defaultIntervalDays: 730, appliesToCar: true, appliesToBike: true },
  { code: 'TIRES', name: 'Tires', defaultIntervalKm: 50_000, defaultIntervalDays: 1_460, appliesToCar: true, appliesToBike: true },
  { code: 'CHAIN', name: 'Chain', defaultIntervalKm: 15_000, defaultIntervalDays: 365, appliesToCar: false, appliesToBike: true },
  { code: 'BATTERY', name: 'Battery', defaultIntervalKm: 0, defaultIntervalDays: 730, appliesToCar: true, appliesToBike: true },
  { code: 'COOLANT', name: 'Coolant', defaultIntervalKm: 40_000, defaultIntervalDays: 730, appliesToCar: true, appliesToBike: false },
];

const AREAS = [
  { name: 'Maadi', color: '#34D399' },
  { name: 'Nasr City', color: '#60A5FA' },
  { name: 'Heliopolis', color: '#F59E0B' },
  { name: 'Downtown', color: '#F87171' },
  { name: 'Zamalek', color: '#A78BFA' },
  { name: 'New Cairo', color: '#22D3EE' },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Seeding catalog…');
  for (const a of APP_CATALOG) {
    await prisma.appSource.upsert({
      where: { code: a.code },
      update: { name: a.name, defaultCommissionPct: a.defaultCommissionPct },
      create: { code: a.code, name: a.name, defaultCommissionPct: a.defaultCommissionPct, isSystem: true },
    });
  }
  for (const m of MAINTENANCE_ITEMS) {
    await prisma.maintenanceItem.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }

  console.log('Seeding demo driver…');
  const passwordHash = await argon2.hash('demo1234', { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { phone: '+201000000001' },
    update: {},
    create: {
      phone: '+201000000001',
      passwordHash,
      locale: 'ar',
      timezone: 'Africa/Cairo',
      driver: { create: { displayName: 'محمد السائق', baseCity: 'Cairo' } },
    },
    include: { driver: true },
  });
  const driverId = user.driver!.id;

  console.log('Vehicle…');
  let vehicle = await prisma.vehicle.findFirst({ where: { driverId } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        type: 'CAR',
        make: 'Hyundai',
        model: 'Verna',
        year: 2019,
        fuelType: 'PETROL_92',
        tankLiters: 45,
        baselineKmPerLiter: 13,
        odometerMeters: BigInt(120_000_000),
      },
    });
  }

  // Clear dependents BEFORE driverApps/areas so foreign-key constraints don't fire on re-seed.
  console.log('Clearing prior operational data…');
  await prisma.trip.deleteMany({ where: { driverId } });
  await prisma.session.deleteMany({ where: { driverId } });
  await prisma.fuelLog.deleteMany({ where: { driverId } });
  await prisma.expense.deleteMany({ where: { driverId } });
  await prisma.maintenanceRecord.deleteMany({ where: { driverId } });
  await prisma.dailyAggregate.deleteMany({ where: { driverId } });
  await prisma.weeklyAggregate.deleteMany({ where: { driverId } });
  await prisma.monthlyAggregate.deleteMany({ where: { driverId } });
  await prisma.appDailyAggregate.deleteMany({ where: { driverId } });
  await prisma.areaDailyAggregate.deleteMany({ where: { driverId } });
  await prisma.recommendation.deleteMany({ where: { driverId } });
  await prisma.scoreSnapshot.deleteMany({ where: { driverId } });

  console.log('Driver apps…');
  const appUber = await prisma.appSource.findUniqueOrThrow({ where: { code: 'UBER' } });
  const appInDrive = await prisma.appSource.findUniqueOrThrow({ where: { code: 'INDRIVE' } });
  const appPrivate = await prisma.appSource.findUniqueOrThrow({ where: { code: 'PRIVATE' } });

  await prisma.driverApp.deleteMany({ where: { driverId } });
  const driverUber = await prisma.driverApp.create({
    data: { driverId, appSourceId: appUber.id, commissionPct: 25, color: '#000000', enabled: true },
  });
  const driverInDrive = await prisma.driverApp.create({
    data: { driverId, appSourceId: appInDrive.id, commissionPct: 10, color: '#22D3EE', enabled: true },
  });
  const driverPrivate = await prisma.driverApp.create({
    data: { driverId, appSourceId: appPrivate.id, commissionPct: 0, color: '#34D399', enabled: true },
  });
  const driverApps = [driverUber, driverInDrive, driverPrivate];

  console.log('Areas…');
  await prisma.area.deleteMany({ where: { driverId } });
  const areas = await Promise.all(
    AREAS.map((a) => prisma.area.create({ data: { driverId, ...a } })),
  );

  console.log('Maintenance baseline…');
  const oilItem = await prisma.maintenanceItem.findUniqueOrThrow({ where: { code: 'ENGINE_OIL' } });
  await prisma.maintenanceRecord.create({
    data: {
      driverId,
      vehicleId: vehicle.id,
      maintenanceItemId: oilItem.id,
      performedAt: new Date(Date.now() - 90 * 86_400_000),
      odometerMeters: BigInt(116_500_000),
      costPiastres: 60_000,
      notes: 'تغيير زيت محرك',
    },
  });

  console.log('30 days of trips, sessions, fuel, expenses…');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let odo = 120_000_000;
  for (let d = 29; d >= 0; d--) {
    const day = new Date(today.getTime() - d * 86_400_000);
    const dayOfWeek = day.getUTCDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const shiftStartHour = isWeekend ? 12 : 8;
    const tripsToday = isWeekend ? randInt(8, 14) : randInt(6, 12);

    const shiftStart = new Date(day.getTime() + shiftStartHour * 3_600_000);
    let cursor = shiftStart;

    const sessionApp = pick(driverApps);
    let totalActiveMin = 0;

    for (let t = 0; t < tripsToday; t++) {
      const idleMin = randInt(5, 20);
      cursor = new Date(cursor.getTime() + idleMin * 60_000);

      const durMin = randInt(8, 35);
      const startedAt = cursor;
      const endedAt = new Date(startedAt.getTime() + durMin * 60_000);

      const paidKm = randInt(2_000, 18_000);
      const emptyKm = randInt(500, 4_000);
      const totalKm = paidKm + emptyKm;

      const perKm = randInt(450, 750);
      const gross = Math.round(paidKm / 1000 * perKm + randInt(1_000, 4_000));
      const app = pick(driverApps);
      const appSource = [appUber, appInDrive, appPrivate].find((a) => a.id === app.appSourceId)!;
      const commissionPct = Number(app.commissionPct);
      const commission = Math.round((gross * commissionPct) / 100);
      const tip = Math.random() < 0.15 ? randInt(500, 2_500) : 0;
      const area = pick(areas);

      await prisma.trip.create({
        data: {
          driverId,
          vehicleId: vehicle.id,
          driverAppId: app.id,
          areaId: area.id,
          startedAt,
          endedAt,
          grossPiastres: gross,
          tipPiastres: tip,
          commissionPiastres: commission,
          totalKmMeters: totalKm,
          paidKmMeters: paidKm,
          emptyKmMeters: emptyKm,
        },
      });
      totalActiveMin += durMin;
      odo += totalKm;
      cursor = endedAt;
    }

    const shiftEnd = cursor;
    await prisma.session.create({
      data: {
        driverId,
        driverAppId: sessionApp.id,
        startedAt: shiftStart,
        endedAt: shiftEnd,
        activeMinutes: totalActiveMin,
      },
    });

    if (d % 4 === 0) {
      const liters = randInt(20, 40);
      const pricePerLiter = 1_525;
      await prisma.fuelLog.create({
        data: {
          driverId,
          vehicleId: vehicle.id,
          dateTime: new Date(day.getTime() + 9 * 3_600_000),
          liters,
          pricePerLiterPiastres: pricePerLiter,
          totalPiastres: liters * pricePerLiter,
          odometerMeters: BigInt(odo),
          isFullTank: d % 8 === 0,
        },
      });
    }

    if (d === 28) {
      await prisma.expense.create({
        data: {
          driverId,
          category: 'RENT',
          amountPiastres: 200_000,
          dateTime: day,
          isRecurring: true,
          recurrenceRule: 'MONTHLY',
        },
      });
    }
    if (d === 15) {
      await prisma.expense.create({
        data: {
          driverId,
          category: 'WASH',
          amountPiastres: 8_000,
          dateTime: day,
        },
      });
    }
    if (Math.random() < 0.06) {
      await prisma.expense.create({
        data: {
          driverId,
          category: pick(['FOOD', 'PARKING', 'PHONE'] as const),
          amountPiastres: randInt(2_000, 8_000),
          dateTime: new Date(day.getTime() + 14 * 3_600_000),
        },
      });
    }
  }

  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { odometerMeters: BigInt(odo) },
  });

  console.log('Active monthly goal…');
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  await prisma.goal.create({
    data: {
      driverId,
      period: 'MONTHLY',
      targetPiastres: 1_500_000,
      startsOn: monthStart,
      endsOn: monthEnd,
      isActive: true,
    },
  });

  console.log('Recomputing aggregates…');
  await recomputeAllAggregates(driverId);

  console.log('\n✓ Seed complete');
  console.log(`Demo login:  phone=+201000000001  password=demo1234`);
}

async function recomputeAllAggregates(driverId: string) {
  const startUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const isoYearWeek = (d: Date) => {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { isoYear: date.getUTCFullYear(), isoWeek };
  };

  const trips = await prisma.trip.findMany({ where: { driverId } });
  const fuels = await prisma.fuelLog.findMany({ where: { driverId } });
  const expenses = await prisma.expense.findMany({ where: { driverId } });
  const sessions = await prisma.session.findMany({ where: { driverId, endedAt: { not: null } } });

  type Daily = {
    tripCount: number; totalKm: bigint; paidKm: bigint; emptyKm: bigint;
    onlineMin: number; gross: bigint; tip: bigint; comm: bigint;
    fuel: bigint; expense: bigint;
  };
  const byDay = new Map<string, Daily>();
  const get = (key: string): Daily => {
    if (!byDay.has(key)) byDay.set(key, {
      tripCount: 0, totalKm: 0n, paidKm: 0n, emptyKm: 0n,
      onlineMin: 0, gross: 0n, tip: 0n, comm: 0n,
      fuel: 0n, expense: 0n,
    });
    return byDay.get(key)!;
  };

  for (const t of trips) {
    const k = startUtcDay(t.startedAt).toISOString();
    const r = get(k);
    r.tripCount++;
    r.totalKm += BigInt(t.totalKmMeters);
    r.paidKm += BigInt(t.paidKmMeters);
    r.emptyKm += BigInt(t.emptyKmMeters);
    r.onlineMin += Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60_000);
    r.gross += BigInt(t.grossPiastres);
    r.tip += BigInt(t.tipPiastres);
    r.comm += BigInt(t.commissionPiastres);
  }
  for (const f of fuels) {
    get(startUtcDay(f.dateTime).toISOString()).fuel += BigInt(f.totalPiastres);
  }
  for (const e of expenses) {
    get(startUtcDay(e.dateTime).toISOString()).expense += BigInt(e.amountPiastres);
  }

  const sessionMin = new Map<string, number>();
  for (const s of sessions) {
    const k = startUtcDay(s.startedAt).toISOString();
    sessionMin.set(k, (sessionMin.get(k) ?? 0) + s.activeMinutes);
  }

  for (const [key, r] of byDay) {
    const date = new Date(key);
    const onlineMin = sessionMin.get(key) ?? r.onlineMin;
    const grossNet = Number(r.gross + r.tip - r.comm);
    const net = grossNet - Number(r.fuel) - Number(r.expense);
    const totalKm = Number(r.totalKm);
    const emptyKm = Number(r.emptyKm);
    const profitPerKm = totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0;
    const profitPerHour = onlineMin > 0 ? Math.round((net * 60) / onlineMin) : 0;
    const emptyRatioBp = totalKm > 0 ? Math.round((emptyKm / totalKm) * 10_000) : 0;

    await prisma.dailyAggregate.upsert({
      where: { driverId_date: { driverId, date } },
      create: {
        driverId, date,
        tripCount: r.tripCount,
        totalKmMeters: r.totalKm,
        paidKmMeters: r.paidKm,
        emptyKmMeters: r.emptyKm,
        onlineMinutes: onlineMin,
        grossPiastres: r.gross,
        tipPiastres: r.tip,
        commissionPiastres: r.comm,
        fuelPiastres: r.fuel,
        expensePiastres: r.expense,
        netProfitPiastres: BigInt(net),
        profitPerKmPiastres: profitPerKm,
        profitPerHourPiastres: profitPerHour,
        emptyRatioBp,
      },
      update: {
        tripCount: r.tripCount,
        totalKmMeters: r.totalKm,
        paidKmMeters: r.paidKm,
        emptyKmMeters: r.emptyKm,
        onlineMinutes: onlineMin,
        grossPiastres: r.gross,
        tipPiastres: r.tip,
        commissionPiastres: r.comm,
        fuelPiastres: r.fuel,
        expensePiastres: r.expense,
        netProfitPiastres: BigInt(net),
        profitPerKmPiastres: profitPerKm,
        profitPerHourPiastres: profitPerHour,
        emptyRatioBp,
      },
    });

    const { isoYear, isoWeek } = isoYearWeek(date);
    await prisma.weeklyAggregate.upsert({
      where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } },
      create: {
        driverId, isoYear, isoWeek,
        tripCount: r.tripCount,
        totalKmMeters: r.totalKm,
        paidKmMeters: r.paidKm,
        emptyKmMeters: r.emptyKm,
        onlineMinutes: onlineMin,
        grossPiastres: r.gross,
        fuelPiastres: r.fuel,
        expensePiastres: r.expense,
        netProfitPiastres: BigInt(net),
      },
      update: {
        tripCount: { increment: r.tripCount },
        totalKmMeters: { increment: r.totalKm },
        paidKmMeters: { increment: r.paidKm },
        emptyKmMeters: { increment: r.emptyKm },
        onlineMinutes: { increment: onlineMin },
        grossPiastres: { increment: r.gross },
        fuelPiastres: { increment: r.fuel },
        expensePiastres: { increment: r.expense },
        netProfitPiastres: { increment: BigInt(net) },
      },
    });

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    await prisma.monthlyAggregate.upsert({
      where: { driverId_year_month: { driverId, year, month } },
      create: {
        driverId, year, month,
        tripCount: r.tripCount,
        totalKmMeters: r.totalKm,
        paidKmMeters: r.paidKm,
        emptyKmMeters: r.emptyKm,
        onlineMinutes: onlineMin,
        grossPiastres: r.gross,
        fuelPiastres: r.fuel,
        expensePiastres: r.expense,
        netProfitPiastres: BigInt(net),
      },
      update: {
        tripCount: { increment: r.tripCount },
        totalKmMeters: { increment: r.totalKm },
        paidKmMeters: { increment: r.paidKm },
        emptyKmMeters: { increment: r.emptyKm },
        onlineMinutes: { increment: onlineMin },
        grossPiastres: { increment: r.gross },
        fuelPiastres: { increment: r.fuel },
        expensePiastres: { increment: r.expense },
        netProfitPiastres: { increment: BigInt(net) },
      },
    });
  }

  type AppRow = { tripCount: number; gross: bigint; km: bigint; minutes: number; net: bigint };
  const byAppDay = new Map<string, AppRow>();
  for (const t of trips) {
    const date = startUtcDay(t.startedAt).toISOString();
    const k = `${t.driverAppId}|${date}`;
    if (!byAppDay.has(k)) byAppDay.set(k, { tripCount: 0, gross: 0n, km: 0n, minutes: 0, net: 0n });
    const r = byAppDay.get(k)!;
    r.tripCount++;
    r.gross += BigInt(t.grossPiastres);
    r.km += BigInt(t.totalKmMeters);
    r.minutes += Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60_000);
    r.net += BigInt(t.grossPiastres + t.tipPiastres - t.commissionPiastres);
  }
  for (const [k, r] of byAppDay) {
    const [driverAppId, dateIso] = k.split('|');
    await prisma.appDailyAggregate.upsert({
      where: { driverId_driverAppId_date: { driverId, driverAppId, date: new Date(dateIso) } },
      create: {
        driverId, driverAppId, date: new Date(dateIso),
        tripCount: r.tripCount,
        grossPiastres: r.gross,
        totalKmMeters: r.km,
        onlineMinutes: r.minutes,
        netProfitPiastres: r.net,
      },
      update: {
        tripCount: r.tripCount,
        grossPiastres: r.gross,
        totalKmMeters: r.km,
        onlineMinutes: r.minutes,
        netProfitPiastres: r.net,
      },
    });
  }

  const byAreaDay = new Map<string, { tripCount: number; gross: bigint; km: bigint; net: bigint }>();
  for (const t of trips) {
    if (!t.areaId) continue;
    const date = startUtcDay(t.startedAt).toISOString();
    const k = `${t.areaId}|${date}`;
    if (!byAreaDay.has(k)) byAreaDay.set(k, { tripCount: 0, gross: 0n, km: 0n, net: 0n });
    const r = byAreaDay.get(k)!;
    r.tripCount++;
    r.gross += BigInt(t.grossPiastres);
    r.km += BigInt(t.totalKmMeters);
    r.net += BigInt(t.grossPiastres + t.tipPiastres - t.commissionPiastres);
  }
  for (const [k, r] of byAreaDay) {
    const [areaId, dateIso] = k.split('|');
    await prisma.areaDailyAggregate.upsert({
      where: { driverId_areaId_date: { driverId, areaId, date: new Date(dateIso) } },
      create: {
        driverId, areaId, date: new Date(dateIso),
        tripCount: r.tripCount,
        grossPiastres: r.gross,
        totalKmMeters: r.km,
        netProfitPiastres: r.net,
      },
      update: {
        tripCount: r.tripCount,
        grossPiastres: r.gross,
        totalKmMeters: r.km,
        netProfitPiastres: r.net,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
