import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeDriverScore, WORK_SCORE_VERSION } from '../analytics/engines/score.engine';
import { addDays, startOfUtcDay } from '../../common/utils/date';
import { businessDate } from '@ehsbha/shared-types';
import { AggregatesService } from '../aggregates/aggregates.service';

import { scoreResponse } from './score-response';

@Injectable()
export class ScoreService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async today(driverId: string) {
    await this.aggregates.ensureCalendar(driverId);
    const today = businessDate(new Date());
    const score = await this.compute(driverId, today);
    const row = await this.prisma.scoreSnapshot.upsert({
      where: { driverId_date_algorithmVersion: { driverId, date: today, algorithmVersion: WORK_SCORE_VERSION } },
      create: { driverId, date: today, ...score },
      update: score,
    });
    return scoreResponse(row);
  }

  async history(driverId: string, from?: Date, to?: Date) {
    const rows = await this.prisma.scoreSnapshot.findMany({
      where: {
        driverId, algorithmVersion: WORK_SCORE_VERSION,
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
    return rows.map(scoreResponse);
  }

  private async compute(driverId: string, date: Date) {
    const since14 = addDays(date, -13);
    const rows = await this.prisma.dailyAggregate.findMany({
      where: { driverId, date: { gte: since14, lte: date } },
      orderBy: { date: 'asc' },
    });

    const todayRow = rows.find((r) => r.date.getTime() === date.getTime());

    const prior = rows.filter((r) => r.date.getTime() < date.getTime());
    const pricePerKmList = prior.filter((r) => r.totalKmMeters > 0n).map((r) => r.profitPerKmPiastres);
    const netList = prior.map((r) => Number(r.netProfitPiastres));
    const onlineMinList = prior.map((r) => r.onlineMinutes);

    const median = (arr: number[]) => {
      if (arr.length < 3) return null;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };
    const variance = (arr: number[]) => {
      if (!arr.length) return 0;
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    };

    return computeDriverScore({
      profitPerKmPiastres: todayRow && todayRow.totalKmMeters > 0n ? todayRow.profitPerKmPiastres : null,
      profitPerKmMedian: median(pricePerKmList),
      netProfitPiastres: todayRow ? Number(todayRow.netProfitPiastres) : null,
      netProfitMedian: median(netList),
      onlineMinutesDeviation: todayRow && prior.length >= 3 ? Math.sqrt(variance(onlineMinList)) : null,
    });
  }
}
