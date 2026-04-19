import { Module } from '@nestjs/common';
import { GatewaysController }  from './gateways.controller';
import { GatewaysService }     from './gateways.service';
import { GatewaySetupService } from './gateway-setup.service';
import { InstallController }   from './install.controller';
import { DatabaseModule }      from '../../database/db.module';
import { InAppNotificationsModule } from '../inapp-notifications/inapp-notifications.module';

@Module({
  imports:     [DatabaseModule, InAppNotificationsModule],
  controllers: [GatewaysController, InstallController],
  providers:   [GatewaysService, GatewaySetupService],
  exports:     [GatewaysService, GatewaySetupService],
})
export class GatewaysModule {}
