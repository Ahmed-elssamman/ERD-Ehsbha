import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AreasService, CreateAreaDto, CreateAreaSchema, UpdateAreaDto, UpdateAreaSchema } from './areas.service';

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly svc: AreasService) {}

  @Get()
  list(@CurrentDriverId() driverId: string) {
    return this.svc.list(driverId);
  }

  @Post()
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateAreaSchema)) dto: CreateAreaDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Patch(':id')
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAreaSchema)) dto: UpdateAreaDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }
}
