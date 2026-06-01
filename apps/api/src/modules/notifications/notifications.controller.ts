import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
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

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly digest: DailyDigestService,
  ) {}

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

  /**
   * Generates today's personalised digest for the current driver and stores
   * it as an in-app notification. Useful for first-time onboarding ("see
   * what tomorrow morning will look like") and for QA — the production
   * cron fires once at 06:30 UTC and a tester shouldn't have to wait for
   * the next day to verify a change.
   */
  @Post('daily-digest/me')
  @HttpCode(HttpStatus.CREATED)
  async triggerDailyDigest(@CurrentDriverId() driverId: string) {
    const id = await this.digest.generateForDriver(driverId);
    if (!id) {
      throw new NotFoundException({
        code: 'DIGEST_INSUFFICIENT_DATA',
        message: 'Not enough trip history or goals to build a digest yet.',
      });
    }
    return { notificationId: id };
  }
}
