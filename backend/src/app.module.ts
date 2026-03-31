import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule }       from './database/db.module';
import { AuthModule }           from './modules/auth/auth.module';
import { UsersModule }          from './modules/users/users.module';
import { OrganizationsModule }  from './modules/organizations/organizations.module';
import { LocationsModule }      from './modules/locations/locations.module';
import { DesksModule }          from './modules/desks/desks.module';
import { DevicesModule }        from './modules/devices/devices.module';
import { GatewaysModule }       from './modules/gateways/gateways.module';
import { ReservationsModule }   from './modules/reservations/reservations.module';
import { CheckinsModule }       from './modules/checkins/checkins.module';
import { MqttModule }           from './mqtt/mqtt.module';

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
    DatabaseModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LocationsModule,
    DesksModule,
    DevicesModule,
    GatewaysModule,
    ReservationsModule,
    CheckinsModule,
    MqttModule,
  ],
  providers: [
    // ThrottlerGuard globalnie — działa na wszystkich endpointach
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
