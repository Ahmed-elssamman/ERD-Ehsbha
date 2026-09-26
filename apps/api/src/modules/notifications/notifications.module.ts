import { AggregatesModule } from '../aggregates/aggregates.module';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DailyDigestService } from './daily-digest.service';
import { NotificationPreferencesService } from './notification-preferences.service';

@Module({
  imports: [AggregatesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DailyDigestService, NotificationPreferencesService],
  exports: [NotificationsService, DailyDigestService],
})
export class NotificationsModule {}
