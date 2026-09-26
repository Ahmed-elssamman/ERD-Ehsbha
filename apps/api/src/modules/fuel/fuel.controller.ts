import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { z } from 'zod';
import { FuelVersionSchema, FuelHistoryQuerySchema, FuelLinkableExpensesQuerySchema, FuelEfficiencyQuerySchema } from '@ehsbha/api-contracts';
import { IdempotentOperation } from '../../common/decorators/idempotent-operation.decorator';
import { FuelQueriesService, FuelHistoryQuery, FuelLinkableExpensesQuery, FuelEfficiencyQuery } from './fuel-queries.service';
import { fuelResponse } from './fuel-response.mapper';
import {
  CreateFuelDto,
  CreateFuelSchema,
  FuelService,
  ListFuelDto,
  ListFuelSchema,
  UpdateFuelDto,
  UpdateFuelSchema,
} from './fuel.service';

const EmptyFuelBodySchema = z.object({}).strict();

@Controller('fuel')
@UseGuards(JwtAuthGuard)
export class FuelController {
  constructor(private svc: FuelService, private queries: FuelQueriesService) {}

  @Get()
  async list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListFuelSchema)) q: ListFuelDto,
  ) {
    return this.queries.list(driverId, q);
  }

  @Get('efficiency')
  efficiency(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(FuelEfficiencyQuerySchema)) q: FuelEfficiencyQuery) {
    return this.queries.efficiency(driverId, q);
  }

  @Get('linkable-expenses')
  linkableExpenses(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(FuelLinkableExpensesQuerySchema)) q: FuelLinkableExpensesQuery) {
    return this.queries.linkableExpenses(driverId, q);
  }

  @Get(':id/history')
  history(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(FuelHistoryQuerySchema)) q: FuelHistoryQuery) {
    return this.queries.history(driverId, id, q);
  }

  @Post()
  @IdempotentOperation({ operationId: 'driver.fuel.create', realm: 'driver', requestSchema: CreateFuelSchema })
  async create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateFuelSchema)) dto: CreateFuelDto,
  ) {
    return fuelResponse(await this.svc.create(driverId, dto));
  }

  @Patch(':id')
  @IdempotentOperation({ operationId: 'driver.fuel.update', realm: 'driver', requestSchema: UpdateFuelSchema, pathParameters: ['id'] })
  async update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFuelSchema)) dto: UpdateFuelDto,
  ) {
    return fuelResponse(await this.svc.update(driverId, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdempotentOperation({ operationId: 'driver.fuel.delete', realm: 'driver', requestSchema: EmptyFuelBodySchema, querySchema: FuelVersionSchema, pathParameters: ['id'] })
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(FuelVersionSchema)) q: z.infer<typeof FuelVersionSchema>) {
    await this.svc.remove(driverId, id, q.expectedVersion);
  }

  @Post(':id/restore')
  @IdempotentOperation({ operationId: 'driver.fuel.restore', realm: 'driver', requestSchema: FuelVersionSchema, pathParameters: ['id'] })
  async restore(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(FuelVersionSchema)) dto: z.infer<typeof FuelVersionSchema>) {
    return fuelResponse(await this.svc.restore(driverId, id, dto.expectedVersion));
  }
}
