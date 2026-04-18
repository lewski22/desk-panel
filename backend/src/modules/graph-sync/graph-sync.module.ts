/**
 * GraphSyncModule — Sprint F (M4) — ZAKTUALIZOWANY
 *
 * backend/src/modules/graph-sync/graph-sync.module.ts
 *
 * UWAGA: ScheduleModule.forRoot() może być wywołane tylko RAZ w całej aplikacji.
 * Jeśli AppModule już importuje ScheduleModule.forRoot() — usuń go stąd
 * i użyj tylko ScheduleModule (bez forRoot()).
 *
 * Sprawdź app.module.ts:
 *   - Jeśli ma ScheduleModule.forRoot() → tutaj użyj ScheduleModule
 *   - Jeśli nie ma → tutaj użyj ScheduleModule.forRoot()
 */
import { Module }          from '@nestjs/common';
import { ScheduleModule }  from '@nestjs/schedule';
import { GraphService }    from './graph.service';
import { GraphController } from './graph.controller';

@Module({
  imports: [
    // Jeśli AppModule ma już ScheduleModule.forRoot() — zamień na: ScheduleModule
    ScheduleModule,
  ],
  controllers: [GraphController],
  providers:   [GraphService],
  exports:     [GraphService],
})
export class GraphSyncModule {}
