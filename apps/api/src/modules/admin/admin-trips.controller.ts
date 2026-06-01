import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminTripsService } from './admin-trips.service';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  driverId: z.string().optional(),
  driverAppId: z.string().optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

@Controller('admin/trips')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminTripsController {
  constructor(private readonly svc: AdminTripsService) {}

  @Get()
  @RequirePermissions('trips.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('trips.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }
}
