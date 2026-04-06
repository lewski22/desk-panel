// ── devices.module.ts ────────────────────────────────────────
import { Module, forwardRef } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MqttModule } from '../../mqtt/mqtt.module';

@Module({
  imports:     [forwardRef(() => MqttModule)],
  controllers: [DevicesController],
  providers:   [DevicesService],
  exports:     [DevicesService],
})
export class DevicesModule {}
