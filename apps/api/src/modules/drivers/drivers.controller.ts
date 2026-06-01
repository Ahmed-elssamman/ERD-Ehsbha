import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';

const UpdateDriverSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  photoUrl: z.string().url().nullable().optional(),
  baseCity: z.string().max(80).nullable().optional(),
});

@Controller('drivers/me')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentDriverId() driverId: string) {
    return this.prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
  }

  @Patch()
  async update(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(UpdateDriverSchema)) dto: z.infer<typeof UpdateDriverSchema>,
  ) {
    return this.prisma.driver.update({ where: { id: driverId }, data: dto });
  }
}
