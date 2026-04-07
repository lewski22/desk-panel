import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService }    from './devices.service';
import { GatewaysModule }    from '../gateways/gateways.module';

@Module({
  imports:     [GatewaysModule],
  controllers: [DevicesController],
  providers:   [DevicesService],
  exports:     [DevicesService],
})
export class DevicesModule {}
