import { Module, Global } from '@nestjs/common';
import { LedEventsService } from './led-events.service';
import { NfcScanService }   from './nfc-scan.service';

@Global()   // dostępny wszędzie bez jawnego importu
@Module({
  providers: [LedEventsService, NfcScanService],
  exports:   [LedEventsService, NfcScanService],
})
export class SharedModule {}
