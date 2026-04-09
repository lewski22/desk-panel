import { Module } from '@nestjs/common';
import { MqttService }    from './mqtt.service';
import { MqttHandlers }   from './mqtt.handlers';
import { CheckinsModule } from '../modules/checkins/checkins.module';
import { GatewaysModule } from '../modules/gateways/gateways.module';
import { MetricsModule }  from '../metrics/metrics.module';
import { DatabaseModule } from '../database/db.module';

/**
 * Dependency graph (BRAK circular):
 *   MqttModule → CheckinsModule  (CheckinsService dla NFC checkin)
 *   MqttModule → GatewaysModule  (GatewaysService dla heartbeat)
 *   DevicesModule → MqttModule   (MqttService dla sendCommand w DevicesController)
 *   SharedModule (global)        → dostępny wszędzie (LedEventsService)
 */
@Module({
  imports:   [CheckinsModule, GatewaysModule, MetricsModule, DatabaseModule],
  providers: [MqttService, MqttHandlers],
  exports:   [MqttService],
})
export class MqttModule {}
