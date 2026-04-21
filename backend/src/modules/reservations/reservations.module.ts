import { Module }               from '@nestjs/common';
import { ScheduleModule }       from '@nestjs/schedule';
import { GatewaysModule }       from '../gateways/gateways.module';
import { NotificationsModule }  from '../notifications/notifications.module';
import { GraphSyncModule }      from '../graph-sync/graph-sync.module';
import { PushModule }           from '../push/push.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService }  from './reservations.service';
// IntegrationsModule jest @Global() — IntegrationEventService dostępny automatycznie

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GatewaysModule,
    NotificationsModule,
    GraphSyncModule,
    PushModule,
  ],
  controllers: [ReservationsController],
  providers:   [ReservationsService],
  exports:     [ReservationsService],
})
export class ReservationsModule {}
