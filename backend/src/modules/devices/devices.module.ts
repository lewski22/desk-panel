import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService }    from './devices.service';
import { MqttModule }        from '../../mqtt/mqtt.module';
import { GatewaysModule }    from '../gateways/gateways.module';

@Module({
  imports:     [MqttModule, GatewaysModule],
  controllers: [DevicesController],
  providers:   [DevicesService],
  exports:     [DevicesService],
})
export class DevicesModule {}
