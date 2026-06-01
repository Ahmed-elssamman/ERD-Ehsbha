import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DailyDigestService } from './daily-digest.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, DailyDigestService],
  exports: [NotificationsService, DailyDigestService],
})
export class NotificationsModule {}
