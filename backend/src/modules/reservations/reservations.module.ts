import { Module } from '@nestjs/common';
import { ScheduleModule }        from '@nestjs/schedule';
import { ReservationsController } from './reservations.controller';
import { ReservationsService }   from './reservations.service';

@Module({
  imports:     [ScheduleModule.forRoot()],
  controllers: [ReservationsController],
  providers:   [ReservationsService],
  exports:     [ReservationsService],
})
export class ReservationsModule {}
