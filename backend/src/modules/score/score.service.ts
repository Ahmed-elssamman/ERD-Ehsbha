import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeDriverScore } from '../analytics/engines/score.engine';
import { addDays, startOfUtcDay } from '../../common/utils/date';

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  async today(driverId: string) {
    const today = startOfUtcDay(new Date());
    const existing = await this.prisma.scoreSnapshot.findUnique({
      where: { driverId_date: { driverId, date: today } },
    });
    if (existing) return existing;

    const score = await this.compute(driverId, today);
    return this.prisma.scoreSnapshot.upsert({
      where: { driverId_date: { driverId, date: today } },
      create: { driverId, date: today, ...score },
      update: score,
    });
  }

  history(driverId: string, from?: Date, to?: Date) {
    return this.prisma.scoreSnapshot.findMany({
      where: {
        driverId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: startOfUtcDay(from) } : {}),
                ...(to ? { lte: startOfUtcDay(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }

  private async compute(driverId: string, date: Date) {
    const since14 = addDays(date, -14);
    const rows = await this.prisma.dailyAggregate.findMany({
      where: { driverId, date: { gte: since14, lte: date } },
      orderBy: { date: 'asc' },
    });

    const todayRow = rows.find((r) => r.date.getTime() === date.getTime());

    const pricePerKmList = rows.map((r) => r.profitPerKmPiastres).filter((v) => v > 0);
    const netList = rows.map((r) => Number(r.netProfitPiastres)).filter((v) => v !== 0);
    const onlineMinList = rows.map((r) => r.onlineMinutes);

    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };
    const variance = (arr: number[]) => {
      if (!arr.length) return 0;
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    };

    const profitPerKm = todayRow?.profitPerKmPiastres ?? 0;
    const net = todayRow ? Number(todayRow.netProfitPiastres) : 0;
    const emptyBp = todayRow?.emptyRatioBp ?? 0;

    const trips = todayRow
      ? await this.prisma.trip.findMany({
          where: { driverId, startedAt: { gte: date, lt: addDays(date, 1) } },
          select: { startedAt: true, endedAt: true },
        })
      : [];
    let nightMin = 0;
    let totalMin = 0;
    for (const t of trips) {
      const dur = Math.max(0, (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000);
      totalMin += dur;
      const h = t.startedAt.getUTCHours();
      if (h >= 23 || h < 5) nightMin += dur;
    }
    const lateNightShare = totalMin > 0 ? nightMin / totalMin : 0;

    const onlineStd = Math.sqrt(variance(onlineMinList));

    return computeDriverScore({
      profitPerKmPiastres: profitPerKm,
      profitPerKmMedian: median(pricePerKmList),
      netProfitPiastres: net,
      netProfitMedian: median(netList),
      emptyRatioBp: emptyBp,
      lateNightShare,
      onlineMinutesVarianceMinutes: onlineStd,
      fatigueScore: 0,
    });
  }
}
