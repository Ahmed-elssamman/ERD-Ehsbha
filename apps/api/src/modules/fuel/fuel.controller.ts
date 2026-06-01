import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  CreateFuelDto,
  CreateFuelSchema,
  FuelService,
  ListFuelDto,
  ListFuelSchema,
  UpdateFuelDto,
  UpdateFuelSchema,
} from './fuel.service';

@Controller('fuel')
@UseGuards(JwtAuthGuard)
export class FuelController {
  constructor(private readonly svc: FuelService) {}

  @Get()
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListFuelSchema)) q: ListFuelDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Post()
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateFuelSchema)) dto: CreateFuelDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Patch(':id')
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFuelSchema)) dto: UpdateFuelDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }
}
