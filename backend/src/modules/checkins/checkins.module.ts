// ── checkins.module.ts ───────────────────────────────────────
import { Module } from '@nestjs/common';
import { MqttModule } from '../../mqtt/mqtt.module';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';

@Module({
  imports:     [MqttModule],
  controllers: [CheckinsController],
  providers:   [CheckinsService],
  exports: [CheckinsService],
})
export class CheckinsModule {}
