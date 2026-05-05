import { Module }    from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GatewaysController }       from './gateways.controller';
import { GatewaysService }          from './gateways.service';
import { GatewaySetupService }      from './gateway-setup.service';
import { GatewayAuthService }       from './gateway-auth.service';
import { GatewayJwtGuard }          from './guards/gateway-jwt.guard';
import { InstallController }        from './install.controller';
import { DatabaseModule }           from '../../database/db.module';
import { InAppNotificationsModule } from '../inapp-notifications/inapp-notifications.module';

@Module({
  imports: [
    DatabaseModule,
    InAppNotificationsModule,
    JwtModule.register({}),   // secret injected per-call via ConfigService
  ],
  controllers: [GatewaysController, InstallController],
  providers:   [GatewaysService, GatewaySetupService, GatewayAuthService, GatewayJwtGuard],
  exports:     [GatewaysService, GatewaySetupService, GatewayAuthService, GatewayJwtGuard],
})
export class GatewaysModule {}
