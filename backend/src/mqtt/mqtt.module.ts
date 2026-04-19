import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service'; import { MqttHandlers } from './mqtt.handlers';
import { CheckinsModule } from '../modules/checkins/checkins.module';
import { GatewaysModule } from '../modules/gateways/gateways.module';
@Module({ imports: [CheckinsModule, GatewaysModule], providers: [MqttService, MqttHandlers], exports: [MqttService] })
export class MqttModule {}
