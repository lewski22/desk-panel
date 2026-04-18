/**
 * PATCH: backend/src/modules/reservations/reservations.module.ts
 *
 * Dodaje GraphSyncModule żeby GraphService był dostępny
 * w ReservationsService przez DI.
 */
import { Module }               from '@nestjs/common';
import { ScheduleModule }       from '@nestjs/schedule';
import { GatewaysModule }       from '../gateways/gateways.module';
import { NotificationsModule }  from '../notifications/notifications.module';
import { GraphSyncModule }      from '../graph-sync/graph-sync.module';   // ← NOWY
import { ReservationsController } from './reservations.controller';
import { ReservationsService }  from './reservations.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GatewaysModule,
    NotificationsModule,
    GraphSyncModule,      // ← DODAJ (eksportuje GraphService)
    // IntegrationsModule jest @Global() — IntegrationEventService dostępny automatycznie
  ],
  controllers: [ReservationsController],
  providers:   [ReservationsService],
  exports:     [ReservationsService],
})
export class ReservationsModule {}
