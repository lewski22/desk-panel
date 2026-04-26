import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { InAppNotificationsService } from './inapp-notifications.service';
import { InAppNotificationsController } from './inapp-notifications.controller';

// IntegrationsModule is @Global
@Module({
  imports:     [ScheduleModule.forRoot(), NotificationsModule, PushModule],
  providers:   [InAppNotificationsService],
  controllers: [InAppNotificationsController],
  exports:     [InAppNotificationsService],
})
export class InAppNotificationsModule {}
