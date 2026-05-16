import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AnalyticsService } from './analytics.service';

const DateSchema = z.object({ date: z.coerce.date().optional() });
const WeekSchema = z.object({
  isoYear: z.coerce.number().int(),
  isoWeek: z.coerce.number().int().min(1).max(53),
});
const MonthSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});
const WindowSchema = z.object({
  window: z.string().regex(/^\d+d$/).default('7d'),
});

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('today')
  today(@CurrentDriverId() driverId: string) {
    return this.svc.today(driverId);
  }

  @Get('daily')
  daily(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(DateSchema)) q: z.infer<typeof DateSchema>,
  ) {
    return this.svc.daily(driverId, q.date ?? new Date());
  }

  @Get('weekly')
  weekly(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(WeekSchema)) q: z.infer<typeof WeekSchema>,
  ) {
    return this.svc.weekly(driverId, q.isoYear, q.isoWeek);
  }

  @Get('monthly')
  monthly(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(MonthSchema)) q: z.infer<typeof MonthSchema>,
  ) {
    return this.svc.monthly(driverId, q.year, q.month);
  }

  @Get('apps')
  apps(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(WindowSchema)) q: z.infer<typeof WindowSchema>,
  ) {
    return this.svc.apps(driverId, Number(q.window.replace('d', '')));
  }

  @Get('areas')
  areas(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(WindowSchema)) q: z.infer<typeof WindowSchema>,
  ) {
    return this.svc.areas(driverId, Number(q.window.replace('d', '')));
  }

  @Get('hours')
  hours(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(WindowSchema)) q: z.infer<typeof WindowSchema>,
  ) {
    return this.svc.hours(driverId, Number(q.window.replace('d', '')));
  }

  @Get('forecast/monthly')
  forecast(@CurrentDriverId() driverId: string) {
    return this.svc.forecastMonthly(driverId);
  }
}
