import { Module } from '@nestjs/common';
import { GatewaysController }  from './gateways.controller';
import { GatewaysService }     from './gateways.service';
import { GatewaySetupService } from './gateway-setup.service';
import { InstallController }   from './install.controller';
import { DatabaseModule }      from '../../database/db.module';

@Module({
  imports:     [DatabaseModule],
  controllers: [GatewaysController, InstallController],
  providers:   [GatewaysService, GatewaySetupService],
  exports:     [GatewaysService, GatewaySetupService],
})
export class GatewaysModule {}
