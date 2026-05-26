import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { TripsService } from './trips.service';
import {
  BatchCreateTripsDto,
  BatchCreateTripsSchema,
  BatchDeleteTripsDto,
  BatchDeleteTripsSchema,
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

  /**
   * Bulk-create endpoint used by the OCR multi-trip flow. The body is an
   * array of CreateTripInput entries; the response surfaces per-index errors
   * so a partial failure doesn't leave the client guessing which trips landed.
   *
   * Limit (20) is intentionally smaller than the single-create rate to keep
   * a misbehaving client from spamming the aggregates pipeline.
   */
  @Post('batch')
  async createBatch(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(BatchCreateTripsSchema)) dto: BatchCreateTripsDto,
  ) {
    return this.svc.createBatch(driverId, dto.items);
  }

  /**
   * Bulk-delete. Body is `{ ids: string[] }` — the trips list UI uses this
   * to remove a multi-selection (or "select all visible") in one request.
   * Status is 200 (not 204) because the body contains per-id errors.
   */
  @Post('batch-delete')
  async removeBatch(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(BatchDeleteTripsSchema)) dto: BatchDeleteTripsDto,
  ) {
    return this.svc.removeBatch(driverId, dto.ids);
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
