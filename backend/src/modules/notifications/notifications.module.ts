import { Module } from '@nestjs/common';
import { ScheduleModule }           from '@nestjs/schedule';
import { DatabaseModule }           from '../../database/db.module';
import { MailerService }            from './mailer.service';
import { NotificationsService }     from './notifications.service';
import { NotificationsController }  from './notifications.controller';

@Module({
  imports:     [ScheduleModule.forRoot(), DatabaseModule],
  providers:   [MailerService, NotificationsService],
  controllers: [NotificationsController],
  exports:     [NotificationsService, MailerService],
})
export class NotificationsModule {}
