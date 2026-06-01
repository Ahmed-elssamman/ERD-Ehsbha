import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminDriversService } from './admin-drivers.service';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  baseCity: z.string().optional(),
});

const TripsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller('admin/drivers')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminDriversController {
  constructor(private readonly svc: AdminDriversService) {}

  @Get()
  @RequirePermissions('drivers.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('drivers.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Get(':id/trips')
  @RequirePermissions('drivers.read')
  trips(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(TripsQuerySchema)) q: z.infer<typeof TripsQuerySchema>,
  ) {
    return this.svc.recentTrips(id, q.limit);
  }
}
