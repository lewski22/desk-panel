import { Module } from '@nestjs/common';
import { ScheduleModule }        from '@nestjs/schedule';
import { GatewaysModule }        from '../gateways/gateways.module';
import { NotificationsModule }   from '../notifications/notifications.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService }   from './reservations.service';

@Module({
  imports:     [ScheduleModule.forRoot(), GatewaysModule, NotificationsModule],
  controllers: [ReservationsController],
  providers:   [ReservationsService],
  exports:     [ReservationsService],
})
export class ReservationsModule {}
