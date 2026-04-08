import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsController } from './metrics.controller';
import { MetricsService }    from './metrics.service';

@Module({
  imports:     [ScheduleModule],
  controllers: [MetricsController],
  providers:   [MetricsService],
  exports:     [MetricsService],
})
export class MetricsModule {}
