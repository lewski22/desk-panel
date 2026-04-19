import { Module } from '@nestjs/common'; import { ScheduleModule } from '@nestjs/schedule';
import { CheckinsController } from './checkins.controller'; import { CheckinsService } from './checkins.service';
import { GatewaysModule } from '../gateways/gateways.module';
// IntegrationsModule is @Global — no import needed
@Module({ imports:[ScheduleModule.forRoot(),GatewaysModule], controllers:[CheckinsController], providers:[CheckinsService], exports:[CheckinsService] })
export class CheckinsModule {}
