import { Module, Global } from '@nestjs/common';
import { LedEventsService } from './led-events.service';

@Global()   // dostępny wszędzie bez jawnego importu
@Module({
  providers: [LedEventsService],
  exports:   [LedEventsService],
})
export class SharedModule {}
