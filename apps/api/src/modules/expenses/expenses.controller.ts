import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { ExpenseVersionSchema } from '@ehsbha/api-contracts';
import { z } from 'zod';
import { IdempotentOperation } from '../../common/decorators/idempotent-operation.decorator';

import {
  CreateExpenseDto,
  CreateExpenseSchema,
  ExpensesService,
  ListExpensesDto,
  ListExpensesSchema,
  UpdateExpenseDto,
  UpdateExpenseSchema,
  ExpenseSummaryQuerySchema, ExpenseSummaryQuery, ExpenseHistoryQuerySchema, ExpenseHistoryQuery,
  ExpenseLinkableTripsQuerySchema, ExpenseLinkableTripsQuery,
} from './expenses.service';

const EmptyExpenseBodySchema = z.object({}).strict();

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get('summary')
  summary(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(ExpenseSummaryQuerySchema)) q: ExpenseSummaryQuery) {
    return this.svc.summary(driverId, q);
  }

  @Get('linkable-trips')
  linkableTrips(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(ExpenseLinkableTripsQuerySchema)) q: ExpenseLinkableTripsQuery) {
    return this.svc.linkableTrips(driverId, q);
  }

  @Get(':id/history')
  history(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(ExpenseHistoryQuerySchema)) q: ExpenseHistoryQuery) {
    return this.svc.history(driverId, id, q);
  }

  @Post(':id/restore')
  @IdempotentOperation({ operationId: 'driver.expenses.restore', realm: 'driver', requestSchema: ExpenseVersionSchema, pathParameters: ['id'] })
  restore(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(ExpenseVersionSchema)) dto: z.infer<typeof ExpenseVersionSchema>) {
    return this.svc.restore(driverId, id, dto.expectedVersion);
  }

  @Get()
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListExpensesSchema)) q: ListExpensesDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Post()
  @IdempotentOperation({ operationId: 'driver.expenses.create', realm: 'driver', requestSchema: CreateExpenseSchema })
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateExpenseSchema)) dto: CreateExpenseDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Patch(':id')
  @IdempotentOperation({ operationId: 'driver.expenses.update', realm: 'driver', requestSchema: UpdateExpenseSchema, pathParameters: ['id'] })
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateExpenseSchema)) dto: UpdateExpenseDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete(':id')
  @IdempotentOperation({ operationId: 'driver.expenses.delete', realm: 'driver', requestSchema: EmptyExpenseBodySchema, querySchema: ExpenseVersionSchema, pathParameters: ['id'] })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(ExpenseVersionSchema)) q: z.infer<typeof ExpenseVersionSchema>) {
    await this.svc.remove(driverId, id, q.expectedVersion);
  }
}
