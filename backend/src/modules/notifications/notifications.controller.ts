import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId, CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  ListNotificationsDto,
  ListNotificationsSchema,
  NotificationsService,
  RegisterDeviceDto,
  RegisterDeviceSchema,
} from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListNotificationsSchema)) q: ListNotificationsDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Post(':id/read')
  read(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    return this.svc.markRead(driverId, id);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) dto: RegisterDeviceDto,
  ) {
    return this.svc.registerDevice(user.userId, dto);
  }
}
