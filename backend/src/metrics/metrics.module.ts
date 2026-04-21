import { Module }            from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService }    from './metrics.service';

// ScheduleModule.forRoot() registered globally in app.module — @Cron decorators work without re-importing
@Module({
  controllers: [MetricsController],
  providers:   [MetricsService],
})
export class MetricsModule {}
