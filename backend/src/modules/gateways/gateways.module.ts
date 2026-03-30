import { Module } from '@nestjs/common';
import { GatewaysController } from './gateways.controller';
import { GatewaysService }    from './gateways.service';
import { GatewaySetupService } from './gateway-setup.service';
import { DatabaseModule }     from '../../database/db.module';

@Module({
  imports:     [DatabaseModule],
  controllers: [GatewaysController],
  providers:   [GatewaysService, GatewaySetupService],
  exports:     [GatewaysService, GatewaySetupService],
})
export class GatewaysModule {}
