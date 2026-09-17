import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UpdateNotificationPreferencesSchema, type UpdateNotificationPreferences } from '@ehsbha/api-contracts';
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
import { DailyDigestService } from './daily-digest.service';
import { NotificationPreferencesService } from './notification-preferences.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private svc: NotificationsService,
    private digest: DailyDigestService,
    private preferences: NotificationPreferencesService,
  ) {}

  @Get('preferences')
  getPreferences(@CurrentDriverId() driverId: string) { return this.preferences.get(driverId); }

  @Patch('preferences')
  updatePreferences(@CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema)) dto: UpdateNotificationPreferences) {
    return this.preferences.update(driverId, dto);
  }

  /**
   * Paginated list of notifications for the current driver.
   * @see {@link CursorQuerySchema} from `@ehsbha/api-contracts` for pagination shape (cursor, limit).
   */
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

  /** Explicit on-demand capture; retries return the existing Cairo-day snapshot. */
  @Post('daily-digest/me')
  @HttpCode(HttpStatus.CREATED)
  async triggerDailyDigest(@CurrentDriverId() driverId: string) {
    const id = await this.digest.generateForDriver(driverId);
    if (!id) {
      throw new NotFoundException({
        code: 'DIGEST_INSUFFICIENT_DATA',
      });
    }
    return { notificationId: id };
  }
}
