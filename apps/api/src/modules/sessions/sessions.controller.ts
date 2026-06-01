import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  EndSessionDto,
  EndSessionSchema,
  ListSessionsDto,
  ListSessionsSchema,
  SessionsService,
  StartSessionDto,
  StartSessionSchema,
} from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly svc: SessionsService) {}

  @Get()
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListSessionsSchema)) q: ListSessionsDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Get('open')
  open(@CurrentDriverId() driverId: string) {
    return this.svc.getOpen(driverId);
  }

  @Post('start')
  start(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(StartSessionSchema)) dto: StartSessionDto,
  ) {
    return this.svc.start(driverId, dto);
  }

  @Post(':id/end')
  end(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EndSessionSchema)) dto: EndSessionDto,
  ) {
    return this.svc.end(driverId, id, dto);
  }
}
