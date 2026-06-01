import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfUtcDay } from '../../common/utils/date';

const PeriodEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const CreateGoalSchema = z.object({
  period: PeriodEnum,
  targetPiastres: z.number().int().min(1),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
});
export type CreateGoalDto = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateGoalDto = z.infer<typeof UpdateGoalSchema>;

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(driverId: string) {
    return this.prisma.goal.findMany({
      where: { driverId },
      orderBy: [{ isActive: 'desc' }, { startsOn: 'desc' }],
    });
  }

  create(driverId: string, dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        driverId,
        period: dto.period,
        targetPiastres: dto.targetPiastres,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
      },
    });
  }

  async update(driverId: string, id: string, dto: UpdateGoalDto) {
    const row = await this.prisma.goal.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'GOAL_NOT_FOUND' });
    return this.prisma.goal.update({ where: { id }, data: dto });
  }

  async remove(driverId: string, id: string) {
    const row = await this.prisma.goal.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'GOAL_NOT_FOUND' });
    await this.prisma.goal.delete({ where: { id } });
  }

  async progress(driverId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, driverId } });
    if (!goal) throw new NotFoundException({ code: 'GOAL_NOT_FOUND' });

    const start = startOfUtcDay(goal.startsOn);
    const end = startOfUtcDay(goal.endsOn);
    const rows = await this.prisma.dailyAggregate.findMany({
      where: { driverId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    const totalNet = rows.reduce((s, r) => s + Number(r.netProfitPiastres), 0);
    const today = startOfUtcDay(new Date());
    const elapsedDays = Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1);
    const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const forecast = Math.round((totalNet * totalDays) / elapsedDays);

    const ratio = totalNet / goal.targetPiastres;
    let status: 'ON_TRACK' | 'LAGGING' | 'AT_RISK' | 'ACHIEVED' = 'ON_TRACK';
    if (totalNet >= goal.targetPiastres) status = 'ACHIEVED';
    else if (forecast >= goal.targetPiastres) status = 'ON_TRACK';
    else if (forecast >= goal.targetPiastres * 0.85) status = 'LAGGING';
    else status = 'AT_RISK';

    return {
      goal,
      currentNetPiastres: totalNet,
      forecastNetPiastres: forecast,
      elapsedDays,
      totalDays,
      progressBp: Math.max(0, Math.min(10_000, Math.round(ratio * 10_000))),
      status,
    };
  }
}
