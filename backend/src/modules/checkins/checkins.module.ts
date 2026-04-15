import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CheckinsController } from './checkins.controller';
import { CheckinsService }    from './checkins.service';
import { GatewaysModule }     from '../gateways/gateways.module';

@Module({
  imports:     [ScheduleModule.forRoot(), GatewaysModule],
  controllers: [CheckinsController],
  // PrismaService dostępny globalnie przez DatabaseModule (@Global w app.module.ts)
  providers:   [CheckinsService],
  exports:     [CheckinsService],
})
export class CheckinsModule {}
