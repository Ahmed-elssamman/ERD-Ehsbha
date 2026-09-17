import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { StartSessionSchema, EndSessionSchema, ListSessionsSchema, CreateWorkSessionSchema, CorrectWorkSessionSchema,
  WorkSessionVersionSchema, WorkSessionHistoryQuerySchema, type StartSessionDto, type EndSessionDto, type ListSessionsDto,
  type CreateWorkSessionDto, type CorrectWorkSessionDto, type WorkSessionVersionDto, type WorkSessionHistoryQuery } from '@ehsbha/api-contracts';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private svc: SessionsService) {}
  @Get()
  list(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(ListSessionsSchema)) q: ListSessionsDto) { return this.svc.list(driverId, q); }
  @Get('open')
  async open(@CurrentDriverId() driverId: string) { return { session: await this.svc.getOpen(driverId) }; }
  @Get(':id/history')
  history(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(WorkSessionHistoryQuerySchema)) q: WorkSessionHistoryQuery) { return this.svc.history(driverId, id, q); }
  @Get(':id')
  get(@CurrentDriverId() driverId: string, @Param('id') id: string) { return this.svc.get(driverId, id); }
  @Post('start')
  start(@CurrentDriverId() driverId: string, @Body(new ZodValidationPipe(StartSessionSchema)) dto: StartSessionDto) { return this.svc.start(driverId, dto); }
  @Post(':id/end')
  end(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(EndSessionSchema)) dto: EndSessionDto) { return this.svc.end(driverId, id, dto); }
  @Post()
  create(@CurrentDriverId() driverId: string, @Body(new ZodValidationPipe(CreateWorkSessionSchema)) dto: CreateWorkSessionDto) { return this.svc.create(driverId, dto); }
  @Patch(':id')
  correct(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(CorrectWorkSessionSchema)) dto: CorrectWorkSessionDto) { return this.svc.correct(driverId, id, dto); }
  @Post(':id/delete')
  remove(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(WorkSessionVersionSchema)) dto: WorkSessionVersionDto) { return this.svc.remove(driverId, id, dto); }
  @Post(':id/restore')
  restore(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(WorkSessionVersionSchema)) dto: WorkSessionVersionDto) { return this.svc.restore(driverId, id, dto); }
}
