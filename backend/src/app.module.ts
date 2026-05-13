import { Module } from '@nestjs/common';
import { SharedModule }             from './shared/shared.module';
import { ConfigModule }             from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule }           from '@nestjs/schedule';
import { HttpMetricsInterceptor }   from './metrics/http-metrics.interceptor';
import { DatabaseModule }           from './database/db.module';
import { AuthModule }               from './modules/auth/auth.module';
import { UsersModule }              from './modules/users/users.module';
import { OrganizationsModule }      from './modules/organizations/organizations.module';
import { LocationsModule }          from './modules/locations/locations.module';
import { DesksModule }              from './modules/desks/desks.module';
import { DevicesModule }            from './modules/devices/devices.module';
import { GatewaysModule }           from './modules/gateways/gateways.module';
import { ResourcesModule }          from './modules/resources/resources.module';
import { PushModule }               from './modules/push/push.module';
import { VisitorsModule }           from './modules/visitors/visitors.module';
import { SubscriptionsModule }      from './modules/subscriptions/subscriptions.module';
import { ReservationsModule }       from './modules/reservations/reservations.module';
import { CheckinsModule }           from './modules/checkins/checkins.module';
import { MqttModule }               from './mqtt/mqtt.module';
import { OwnerModule }              from './modules/owner/owner.module';
import { MetricsModule }            from './metrics/metrics.module';
import { NotificationsModule }      from './modules/notifications/notifications.module';
import { InAppNotificationsModule } from './modules/inapp-notifications/inapp-notifications.module';
import { ReportsModule }            from './modules/reports/reports.module';
// ── Nowe moduły v0.17.0 (2026-04-18) ─────────────────────────────────────────
import { IntegrationsModule }       from './modules/integrations/integrations.module';
import { RecommendationsModule }    from './modules/recommendations/recommendations.module';
import { InsightsModule }           from './modules/insights/insights.module';
import { GraphSyncModule }          from './modules/graph-sync/graph-sync.module';
import { TeamsBotModule }           from './modules/teams-bot/teams-bot.module';
import { StorageModule }            from './modules/storage/storage.module';
import { KioskModule }             from './modules/kiosk/kiosk.module';
import { ParkingGroupsModule }     from './modules/parking-groups/parking-groups.module';
import { ParkingBlocksModule }     from './modules/parking-blocks/parking-blocks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      name:  'default',
      ttl:   60_000,  // 1 minuta
      limit: 30,      // max 30 requestów per IP
    }]),
    ScheduleModule.forRoot(),
    SharedModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LocationsModule,
    DesksModule,
    DevicesModule,
    GatewaysModule,
    ResourcesModule,
    PushModule,
    VisitorsModule,
    SubscriptionsModule,
    ReservationsModule,
    CheckinsModule,
    MqttModule,
    OwnerModule,
    MetricsModule,
    NotificationsModule,
    InAppNotificationsModule,
    ReportsModule,
    KioskModule,
    ParkingGroupsModule,
    ParkingBlocksModule,
    StorageModule,          // @Global — R2/S3 CDN for floor plans
    // ── v0.17.0 ───────────────────────────────────────────────
    IntegrationsModule,     // @Global — Slack/Teams/Webhook/Azure/Google per-org
    RecommendationsModule,  // K1 — AI desk recommendations
    InsightsModule,         // K2 — utilization insights + cron
    GraphSyncModule,        // M4 — Microsoft Graph Calendar Sync
    TeamsBotModule,         // Teams Bot Framework — slash commands
  ],
  providers: [
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
