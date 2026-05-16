import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { ScoreService } from './score.service';

const HistorySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

@Controller('score')
@UseGuards(JwtAuthGuard)
export class ScoreController {
  constructor(private readonly svc: ScoreService) {}

  @Get('today')
  today(@CurrentDriverId() driverId: string) {
    return this.svc.today(driverId);
  }

  @Get('history')
  history(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(HistorySchema)) q: z.infer<typeof HistorySchema>,
  ) {
    return this.svc.history(driverId, q.from, q.to);
  }
}
