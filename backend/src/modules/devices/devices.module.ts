import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService }    from './devices.service';
import { GatewaysModule }    from '../gateways/gateways.module';
import { ScheduleModule }    from '@nestjs/schedule';
import { ConfigModule }      from '@nestjs/config';

@Module({
  imports:     [ScheduleModule.forRoot(), GatewaysModule, ConfigModule],
  controllers: [DevicesController],
  providers:   [DevicesService],
  exports:     [DevicesService],
})
export class DevicesModule {}
