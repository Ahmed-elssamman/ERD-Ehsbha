import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';

const UpdateUserSchema = z.object({
  locale: z.enum(['ar', 'en']).optional(),
  timezone: z.string().optional(),
  email: z.string().email().optional(),
});

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { driver: true },
    });
    if (!row) return null;
    const { passwordHash: _, ...safe } = row;
    return safe;
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: z.infer<typeof UpdateUserSchema>,
  ) {
    const row = await this.prisma.user.update({
      where: { id: user.userId },
      data: dto,
    });
    const { passwordHash: _, ...safe } = row;
    return safe;
  }
}
