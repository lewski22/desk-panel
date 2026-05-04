import { Module } from '@nestjs/common';
import { VisitorsController }  from './visitors.controller';
import { VisitorsService }     from './visitors.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  controllers: [VisitorsController],
  providers:   [VisitorsService],
  exports:     [VisitorsService],
})
export class VisitorsModule {}
