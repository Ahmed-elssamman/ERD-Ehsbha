import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  CreateMaintenanceRecordDto,
  CreateMaintenanceRecordSchema,
  MaintenanceService,
} from './maintenance.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Get('maintenance/items')
  items() {
    return this.svc.listItems();
  }

  @Get('vehicles/:vehicleId/maintenance/records')
  records(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string) {
    return this.svc.listRecords(driverId, vehicleId);
  }

  @Post('vehicles/:vehicleId/maintenance/records')
  add(
    @CurrentDriverId() driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Body(new ZodValidationPipe(CreateMaintenanceRecordSchema)) dto: CreateMaintenanceRecordDto,
  ) {
    return this.svc.addRecord(driverId, vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/maintenance/risk')
  risk(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string) {
    return this.svc.risk(driverId, vehicleId);
  }
}
