import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ListMaintenanceRecordsSchema, MaintenanceHistoryQuerySchema, MaintenanceLinkableExpensesQuerySchema, MaintenanceVersionSchema } from '@ehsbha/api-contracts';
import { IdempotentOperation } from '../../common/decorators/idempotent-operation.decorator';
import { MaintenanceQueriesService, ListMaintenanceRecordsDto, MaintenanceHistoryQuery, MaintenanceLinkableExpensesQuery } from './maintenance-queries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  CreateMaintenanceRecordDto,
  CreateMaintenanceRecordSchema,
  MaintenanceService,
  UpdateMaintenanceRecordSchema, UpdateMaintenanceRecordDto,
} from './maintenance.service';

const EmptyMaintenanceBodySchema = z.object({}).strict();

@Controller()
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private svc: MaintenanceService, private queries: MaintenanceQueriesService) {}

  @Get('maintenance/items')
  items() {
    return this.svc.listItems();
  }

  @Get('vehicles/:vehicleId/maintenance/records')
  records(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string, @Query(new ZodValidationPipe(ListMaintenanceRecordsSchema)) q: ListMaintenanceRecordsDto) {
    return this.queries.list(driverId, vehicleId, q);
  }

  @Post('vehicles/:vehicleId/maintenance/records')
  @IdempotentOperation({ operationId: 'driver.maintenance.records.create', realm: 'driver', requestSchema: CreateMaintenanceRecordSchema, pathParameters: ['vehicleId'] })
  add(
    @CurrentDriverId() driverId: string,
    @Param('vehicleId') vehicleId: string,
    @Body(new ZodValidationPipe(CreateMaintenanceRecordSchema)) dto: CreateMaintenanceRecordDto,
  ) {
    return this.svc.addRecord(driverId, vehicleId, dto);
  }

  @Patch('vehicles/:vehicleId/maintenance/records/:id')
  @IdempotentOperation({ operationId: 'driver.maintenance.records.update', realm: 'driver', requestSchema: UpdateMaintenanceRecordSchema, pathParameters: ['vehicleId', 'id'] })
  update(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string, @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceRecordSchema)) dto: UpdateMaintenanceRecordDto) {
    return this.svc.updateRecord(driverId, vehicleId, id, dto);
  }

  @Delete('vehicles/:vehicleId/maintenance/records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdempotentOperation({ operationId: 'driver.maintenance.records.delete', realm: 'driver', requestSchema: EmptyMaintenanceBodySchema, querySchema: MaintenanceVersionSchema, pathParameters: ['vehicleId', 'id'] })
  async remove(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string, @Param('id') id: string,
    @Query(new ZodValidationPipe(MaintenanceVersionSchema)) q: z.infer<typeof MaintenanceVersionSchema>) {
    await this.svc.removeRecord(driverId, vehicleId, id, q.expectedVersion);
  }

  @Post('vehicles/:vehicleId/maintenance/records/:id/restore')
  @IdempotentOperation({ operationId: 'driver.maintenance.records.restore', realm: 'driver', requestSchema: MaintenanceVersionSchema, pathParameters: ['vehicleId', 'id'] })
  restore(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string, @Param('id') id: string,
    @Body(new ZodValidationPipe(MaintenanceVersionSchema)) dto: z.infer<typeof MaintenanceVersionSchema>) {
    return this.svc.restoreRecord(driverId, vehicleId, id, dto.expectedVersion);
  }

  @Get('vehicles/:vehicleId/maintenance/records/:id/history')
  history(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string, @Param('id') id: string,
    @Query(new ZodValidationPipe(MaintenanceHistoryQuerySchema)) q: MaintenanceHistoryQuery) {
    return this.queries.history(driverId, vehicleId, id, q);
  }

  @Get('vehicles/:vehicleId/maintenance/linkable-expenses')
  linkableExpenses(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string,
    @Query(new ZodValidationPipe(MaintenanceLinkableExpensesQuerySchema)) q: MaintenanceLinkableExpensesQuery) {
    return this.queries.linkableExpenses(driverId, vehicleId, q);
  }

  @Get('vehicles/:vehicleId/maintenance/risk')
  risk(@CurrentDriverId() driverId: string, @Param('vehicleId') vehicleId: string) {
    return this.svc.risk(driverId, vehicleId);
  }
}
