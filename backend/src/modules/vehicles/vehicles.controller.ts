import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, CreateVehicleSchema, UpdateVehicleDto, UpdateVehicleSchema } from './dto/vehicles.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly svc: VehiclesService) {}

  @Get()
  list(@CurrentDriverId() driverId: string) {
    return this.svc.list(driverId);
  }

  @Post()
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateVehicleSchema)) dto: CreateVehicleDto,
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
    @Body(new ZodValidationPipe(UpdateVehicleSchema)) dto: UpdateVehicleDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }
}
