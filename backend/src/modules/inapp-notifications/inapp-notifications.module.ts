import { Module } from '@nestjs/common';
import { ScheduleModule }                  from '@nestjs/schedule';
import { DatabaseModule }                  from '../../database/db.module';
import { InAppNotificationsService }       from './inapp-notifications.service';
import { InAppNotificationsController }    from './inapp-notifications.controller';

@Module({
  imports:     [ScheduleModule.forRoot(), DatabaseModule],
  providers:   [InAppNotificationsService],
  controllers: [InAppNotificationsController],
  exports:     [InAppNotificationsService],
})
export class InAppNotificationsModule {}
