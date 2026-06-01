import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isoYearWeek, startOfUtcDay, diffMinutes } from '../../common/utils/date';
import { safeDiv, toBp } from '../../common/utils/money';

export interface TripDelta {
  driverId: string;
  driverAppId: string;
  areaId?: string | null;
  startedAt: Date;
  endedAt: Date;
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  totalKmMeters: number;
  paidKmMeters: number;
  emptyKmMeters: number;
  sign: 1 | -1;
}

export interface FuelDelta {
  driverId: string;
  dateTime: Date;
  totalPiastres: number;
  sign: 1 | -1;
}

export interface ExpenseDelta {
  driverId: string;
  dateTime: Date;
  amountPiastres: number;
  sign: 1 | -1;
}

export interface SessionDelta {
  driverId: string;
  driverAppId: string;
  startedAt: Date;
  endedAt: Date;
  activeMinutes: number;
  sign: 1 | -1;
}

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AggregatesService {
  constructor(private readonly prisma: PrismaService) {}

  async applyTrip(d: TripDelta, tx: Tx = this.prisma): Promise<void> {
    const date = startOfUtcDay(d.startedAt);
    const { isoYear, isoWeek } = isoYearWeek(d.startedAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const sign = d.sign;

    const tripMinutes = diffMinutes(d.startedAt, d.endedAt);

    const inc = (n: number) => sign * n;
    const incB = (n: number) => BigInt(sign * n);

    await tx.dailyAggregate.upsert({
      where: { driverId_date: { driverId: d.driverId, date } },
      create: {
        driverId: d.driverId,
        date,
        tripCount: inc(1),
        totalKmMeters: incB(d.totalKmMeters),
        paidKmMeters: incB(d.paidKmMeters),
        emptyKmMeters: incB(d.emptyKmMeters),
        onlineMinutes: inc(tripMinutes),
        grossPiastres: incB(d.grossPiastres),
        tipPiastres: incB(d.tipPiastres),
        commissionPiastres: incB(d.commissionPiastres),
      },
      update: {
        tripCount: { increment: inc(1) },
        totalKmMeters: { increment: incB(d.totalKmMeters) },
        paidKmMeters: { increment: incB(d.paidKmMeters) },
        emptyKmMeters: { increment: incB(d.emptyKmMeters) },
        onlineMinutes: { increment: inc(tripMinutes) },
        grossPiastres: { increment: incB(d.grossPiastres) },
        tipPiastres: { increment: incB(d.tipPiastres) },
        commissionPiastres: { increment: incB(d.commissionPiastres) },
      },
    });

    await tx.weeklyAggregate.upsert({
      where: { driverId_isoYear_isoWeek: { driverId: d.driverId, isoYear, isoWeek } },
      create: {
        driverId: d.driverId,
        isoYear,
        isoWeek,
        tripCount: inc(1),
        totalKmMeters: incB(d.totalKmMeters),
        paidKmMeters: incB(d.paidKmMeters),
        emptyKmMeters: incB(d.emptyKmMeters),
        onlineMinutes: inc(tripMinutes),
        grossPiastres: incB(d.grossPiastres),
      },
      update: {
        tripCount: { increment: inc(1) },
        totalKmMeters: { increment: incB(d.totalKmMeters) },
        paidKmMeters: { increment: incB(d.paidKmMeters) },
        emptyKmMeters: { increment: incB(d.emptyKmMeters) },
        onlineMinutes: { increment: inc(tripMinutes) },
        grossPiastres: { increment: incB(d.grossPiastres) },
      },
    });

    await tx.monthlyAggregate.upsert({
      where: { driverId_year_month: { driverId: d.driverId, year, month } },
      create: {
        driverId: d.driverId,
        year,
        month,
        tripCount: inc(1),
        totalKmMeters: incB(d.totalKmMeters),
        paidKmMeters: incB(d.paidKmMeters),
        emptyKmMeters: incB(d.emptyKmMeters),
        onlineMinutes: inc(tripMinutes),
        grossPiastres: incB(d.grossPiastres),
      },
      update: {
        tripCount: { increment: inc(1) },
        totalKmMeters: { increment: incB(d.totalKmMeters) },
        paidKmMeters: { increment: incB(d.paidKmMeters) },
        emptyKmMeters: { increment: incB(d.emptyKmMeters) },
        onlineMinutes: { increment: inc(tripMinutes) },
        grossPiastres: { increment: incB(d.grossPiastres) },
      },
    });

    const grossNetForTrip = d.grossPiastres + d.tipPiastres - d.commissionPiastres;
    await tx.appDailyAggregate.upsert({
      where: { driverId_driverAppId_date: { driverId: d.driverId, driverAppId: d.driverAppId, date } },
      create: {
        driverId: d.driverId,
        driverAppId: d.driverAppId,
        date,
        tripCount: inc(1),
        totalKmMeters: incB(d.totalKmMeters),
        onlineMinutes: inc(tripMinutes),
        grossPiastres: incB(d.grossPiastres),
        netProfitPiastres: incB(grossNetForTrip),
      },
      update: {
        tripCount: { increment: inc(1) },
        totalKmMeters: { increment: incB(d.totalKmMeters) },
        onlineMinutes: { increment: inc(tripMinutes) },
        grossPiastres: { increment: incB(d.grossPiastres) },
        netProfitPiastres: { increment: incB(grossNetForTrip) },
      },
    });

    if (d.areaId) {
      await tx.areaDailyAggregate.upsert({
        where: { driverId_areaId_date: { driverId: d.driverId, areaId: d.areaId, date } },
        create: {
          driverId: d.driverId,
          areaId: d.areaId,
          date,
          tripCount: inc(1),
          totalKmMeters: incB(d.totalKmMeters),
          grossPiastres: incB(d.grossPiastres),
          netProfitPiastres: incB(grossNetForTrip),
        },
        update: {
          tripCount: { increment: inc(1) },
          totalKmMeters: { increment: incB(d.totalKmMeters) },
          grossPiastres: { increment: incB(d.grossPiastres) },
          netProfitPiastres: { increment: incB(grossNetForTrip) },
        },
      });
    }

    await this.recomputeRatios(d.driverId, date, isoYear, isoWeek, year, month, tx);
  }

  async applyFuel(d: FuelDelta, tx: Tx = this.prisma): Promise<void> {
    const date = startOfUtcDay(d.dateTime);
    const { isoYear, isoWeek } = isoYearWeek(d.dateTime);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const incB = (n: number) => BigInt(d.sign * n);

    await tx.dailyAggregate.upsert({
      where: { driverId_date: { driverId: d.driverId, date } },
      create: { driverId: d.driverId, date, fuelPiastres: incB(d.totalPiastres) },
      update: { fuelPiastres: { increment: incB(d.totalPiastres) } },
    });
    await tx.weeklyAggregate.upsert({
      where: { driverId_isoYear_isoWeek: { driverId: d.driverId, isoYear, isoWeek } },
      create: { driverId: d.driverId, isoYear, isoWeek, fuelPiastres: incB(d.totalPiastres) },
      update: { fuelPiastres: { increment: incB(d.totalPiastres) } },
    });
    await tx.monthlyAggregate.upsert({
      where: { driverId_year_month: { driverId: d.driverId, year, month } },
      create: { driverId: d.driverId, year, month, fuelPiastres: incB(d.totalPiastres) },
      update: { fuelPiastres: { increment: incB(d.totalPiastres) } },
    });
    await this.recomputeRatios(d.driverId, date, isoYear, isoWeek, year, month, tx);
  }

  async applyExpense(d: ExpenseDelta, tx: Tx = this.prisma): Promise<void> {
    const date = startOfUtcDay(d.dateTime);
    const { isoYear, isoWeek } = isoYearWeek(d.dateTime);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const incB = (n: number) => BigInt(d.sign * n);

    await tx.dailyAggregate.upsert({
      where: { driverId_date: { driverId: d.driverId, date } },
      create: { driverId: d.driverId, date, expensePiastres: incB(d.amountPiastres) },
      update: { expensePiastres: { increment: incB(d.amountPiastres) } },
    });
    await tx.weeklyAggregate.upsert({
      where: { driverId_isoYear_isoWeek: { driverId: d.driverId, isoYear, isoWeek } },
      create: { driverId: d.driverId, isoYear, isoWeek, expensePiastres: incB(d.amountPiastres) },
      update: { expensePiastres: { increment: incB(d.amountPiastres) } },
    });
    await tx.monthlyAggregate.upsert({
      where: { driverId_year_month: { driverId: d.driverId, year, month } },
      create: { driverId: d.driverId, year, month, expensePiastres: incB(d.amountPiastres) },
      update: { expensePiastres: { increment: incB(d.amountPiastres) } },
    });
    await this.recomputeRatios(d.driverId, date, isoYear, isoWeek, year, month, tx);
  }

  async applySession(d: SessionDelta, tx: Tx = this.prisma): Promise<void> {
    const date = startOfUtcDay(d.startedAt);
    const { isoYear, isoWeek } = isoYearWeek(d.startedAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const inc = (n: number) => d.sign * n;

    await tx.dailyAggregate.upsert({
      where: { driverId_date: { driverId: d.driverId, date } },
      create: { driverId: d.driverId, date, onlineMinutes: inc(d.activeMinutes) },
      update: { onlineMinutes: { increment: inc(d.activeMinutes) } },
    });
    await tx.weeklyAggregate.upsert({
      where: { driverId_isoYear_isoWeek: { driverId: d.driverId, isoYear, isoWeek } },
      create: { driverId: d.driverId, isoYear, isoWeek, onlineMinutes: inc(d.activeMinutes) },
      update: { onlineMinutes: { increment: inc(d.activeMinutes) } },
    });
    await tx.monthlyAggregate.upsert({
      where: { driverId_year_month: { driverId: d.driverId, year, month } },
      create: { driverId: d.driverId, year, month, onlineMinutes: inc(d.activeMinutes) },
      update: { onlineMinutes: { increment: inc(d.activeMinutes) } },
    });

    await tx.appDailyAggregate.upsert({
      where: { driverId_driverAppId_date: { driverId: d.driverId, driverAppId: d.driverAppId, date } },
      create: {
        driverId: d.driverId,
        driverAppId: d.driverAppId,
        date,
        onlineMinutes: inc(d.activeMinutes),
      },
      update: { onlineMinutes: { increment: inc(d.activeMinutes) } },
    });

    await this.recomputeRatios(d.driverId, date, isoYear, isoWeek, year, month, tx);
  }

  private async recomputeRatios(
    driverId: string,
    date: Date,
    isoYear: number,
    isoWeek: number,
    year: number,
    month: number,
    tx: Tx,
  ): Promise<void> {
    const daily = await tx.dailyAggregate.findUnique({ where: { driverId_date: { driverId, date } } });
    if (daily) {
      const gross = Number(daily.grossPiastres) + Number(daily.tipPiastres) - Number(daily.commissionPiastres);
      const net = gross - Number(daily.fuelPiastres) - Number(daily.expensePiastres) - Number(daily.maintAmortPiastres);
      const totalKm = Number(daily.totalKmMeters);
      const totalEmpty = Number(daily.emptyKmMeters);
      const profitPerKm = totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0;
      const profitPerHour = daily.onlineMinutes > 0 ? Math.round((net * 60) / daily.onlineMinutes) : 0;
      const emptyRatio = toBp(safeDiv(totalEmpty, totalKm, 0));
      await tx.dailyAggregate.update({
        where: { driverId_date: { driverId, date } },
        data: {
          netProfitPiastres: BigInt(net),
          profitPerKmPiastres: profitPerKm,
          profitPerHourPiastres: profitPerHour,
          emptyRatioBp: emptyRatio,
        },
      });
    }

    const weekly = await tx.weeklyAggregate.findUnique({
      where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } },
    });
    if (weekly) {
      const gross = Number(weekly.grossPiastres);
      const net = gross - Number(weekly.fuelPiastres) - Number(weekly.expensePiastres) - Number(weekly.maintAmortPiastres);
      const totalKm = Number(weekly.totalKmMeters);
      const totalEmpty = Number(weekly.emptyKmMeters);
      await tx.weeklyAggregate.update({
        where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } },
        data: {
          netProfitPiastres: BigInt(net),
          profitPerKmPiastres: totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0,
          profitPerHourPiastres: weekly.onlineMinutes > 0 ? Math.round((net * 60) / weekly.onlineMinutes) : 0,
          emptyRatioBp: toBp(safeDiv(totalEmpty, totalKm, 0)),
        },
      });
    }

    const monthly = await tx.monthlyAggregate.findUnique({ where: { driverId_year_month: { driverId, year, month } } });
    if (monthly) {
      const gross = Number(monthly.grossPiastres);
      const net = gross - Number(monthly.fuelPiastres) - Number(monthly.expensePiastres) - Number(monthly.maintAmortPiastres);
      const totalKm = Number(monthly.totalKmMeters);
      const totalEmpty = Number(monthly.emptyKmMeters);
      await tx.monthlyAggregate.update({
        where: { driverId_year_month: { driverId, year, month } },
        data: {
          netProfitPiastres: BigInt(net),
          profitPerKmPiastres: totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0,
          profitPerHourPiastres: monthly.onlineMinutes > 0 ? Math.round((net * 60) / monthly.onlineMinutes) : 0,
          emptyRatioBp: toBp(safeDiv(totalEmpty, totalKm, 0)),
        },
      });
    }
  }
}
