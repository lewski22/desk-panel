import { Module }           from '@nestjs/common';
import { ScheduleModule }  from '@nestjs/schedule';
import { InsightsController } from './insights.controller';
import { InsightsService }    from './insights.service';

@Module({
  imports:     [ScheduleModule],
  controllers: [InsightsController],
  providers:   [InsightsService],
  exports:     [InsightsService],
})
export class InsightsModule {}
