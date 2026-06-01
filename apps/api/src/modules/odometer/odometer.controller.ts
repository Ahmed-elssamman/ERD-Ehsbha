import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { OdometerService, SetDailyOdometerDto, SetDailyOdometerSchema } from './odometer.service';

const DateQuery = z.object({ date: z.coerce.date().optional() });

@Controller('odometer/daily')
@UseGuards(JwtAuthGuard)
export class OdometerController {
  constructor(private readonly svc: OdometerService) {}

  @Get()
  get(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(DateQuery)) q: z.infer<typeof DateQuery>,
  ) {
    return this.svc.get(driverId, q.date);
  }

  @Post()
  set(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(SetDailyOdometerSchema)) dto: SetDailyOdometerDto,
  ) {
    return this.svc.set(driverId, dto);
  }
}
