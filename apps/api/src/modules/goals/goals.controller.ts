import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  CreateGoalDto,
  CreateGoalSchema,
  GoalsService,
  UpdateGoalDto,
  UpdateGoalSchema,
} from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly svc: GoalsService) {}

  @Get()
  list(@CurrentDriverId() driverId: string) {
    return this.svc.list(driverId);
  }

  @Post()
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateGoalSchema)) dto: CreateGoalDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Patch(':id')
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateGoalSchema)) dto: UpdateGoalDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }

  @Get(':id/progress')
  progress(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    return this.svc.progress(driverId, id);
  }
}
