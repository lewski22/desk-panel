import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReservationsController } from './reservations.controller';
import { ReservationsService }    from './reservations.service';
import { MqttModule }             from '../../mqtt/mqtt.module';

@Module({
  imports:     [ScheduleModule.forRoot(), forwardRef(() => MqttModule)],
  controllers: [ReservationsController],
  providers:   [ReservationsService],
  exports:     [ReservationsService],
})
export class ReservationsModule {}
