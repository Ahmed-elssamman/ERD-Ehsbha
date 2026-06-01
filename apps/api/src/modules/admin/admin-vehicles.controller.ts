import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminVehiclesService } from './admin-vehicles.service';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['CAR', 'BIKE']).optional(),
  isActive: z.coerce.boolean().optional(),
  driverId: z.string().optional(),
});

@Controller('admin/vehicles')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminVehiclesController {
  constructor(private readonly svc: AdminVehiclesService) {}

  @Get()
  @RequirePermissions('vehicles.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('vehicles.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }
}
