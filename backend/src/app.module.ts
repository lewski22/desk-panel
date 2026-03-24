import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
})
export class AppModule {}
