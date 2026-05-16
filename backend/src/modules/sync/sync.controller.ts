import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { PullDto, PullSchema, PushDto, PushSchema, SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  @Post('pull')
  pull(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(PullSchema)) dto: PullDto,
  ) {
    return this.svc.pull(driverId, dto);
  }

  @Post('push')
  push(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(PushSchema)) dto: PushDto,
  ) {
    return this.svc.push(driverId, dto);
  }
}
