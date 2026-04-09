import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CheckinsController } from './checkins.controller';
import { CheckinsService }    from './checkins.service';

@Module({
  imports:     [ScheduleModule.forRoot()],
  controllers: [CheckinsController],
  providers:   [CheckinsService],
  exports:     [CheckinsService],
})
export class CheckinsModule {}
