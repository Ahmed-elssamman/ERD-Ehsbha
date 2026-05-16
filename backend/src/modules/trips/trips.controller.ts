import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { TripsService } from './trips.service';
import {
  CreateTripDto,
  CreateTripSchema,
  ListTripsDto,
  ListTripsSchema,
  UpdateTripDto,
  UpdateTripSchema,
} from './dto/trips.dto';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly svc: TripsService) {}

  @Get()
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListTripsSchema)) q: ListTripsDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Post()
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateTripSchema)) dto: CreateTripDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Get(':id')
  get(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    return this.svc.get(driverId, id);
  }

  @Patch(':id')
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTripSchema)) dto: UpdateTripDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }
}
