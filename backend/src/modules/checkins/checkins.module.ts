// ── checkins.module.ts ───────────────────────────────────────
import { Module, forwardRef } from '@nestjs/common';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { MqttModule } from '../../mqtt/mqtt.module';

@Module({
  imports:     [forwardRef(() => MqttModule)],
  controllers: [CheckinsController],
  providers:   [CheckinsService],
  exports:     [CheckinsService],
})
export class CheckinsModule {}
