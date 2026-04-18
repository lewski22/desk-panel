import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';
import { DatabaseModule }       from './database/db.module';
import { AuthModule }           from './modules/auth/auth.module';
import { UsersModule }          from './modules/users/users.module';
import { OrganizationsModule }  from './modules/organizations/organizations.module';
import { LocationsModule }      from './modules/locations/locations.module';
import { DesksModule }          from './modules/desks/desks.module';
import { DevicesModule }        from './modules/devices/devices.module';
import { GatewaysModule }       from './modules/gateways/gateways.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { PushModule }       from './modules/push/push.module';
import { VisitorsModule }       from './modules/visitors/visitors.module';
import { SubscriptionsModule }  from './modules/subscriptions/subscriptions.module';
import { ReservationsModule }   from './modules/reservations/reservations.module';
import { CheckinsModule }       from './modules/checkins/checkins.module';
import { MqttModule }           from './mqtt/mqtt.module';
import { OwnerModule }          from './modules/owner/owner.module';
import { MetricsModule }        from './metrics/metrics.module';
import { NotificationsModule }  from './modules/notifications/notifications.module';
import { InAppNotificationsModule } from './modules/inapp-notifications/inapp-notifications.module';
import { GraphSyncModule } from './modules/graph-sync/graph-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting globalny — chroni przed brute force i enumeration
    // Domyślne limity: 30 req/min per IP dla większości endpointów
    // Auth endpoints mają własne, niższe limity przez @Throttle() dekorator
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
    IntegrationsModule,
    RecommendationsModule,
    InsightsModule,
    GraphSyncModule,
  ],
  providers: [
    // ThrottlerGuard globalnie — działa na wszystkich endpointach
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
    // HttpMetricsInterceptor — mierzy czas i zlicza żądania HTTP
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
