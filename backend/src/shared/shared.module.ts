import { Global, Module } from '@nestjs/common';
import { LedEventsService } from './led-events.service';
import { NfcScanService } from './nfc-scan.service';
@Global()
@Module({ providers: [LedEventsService, NfcScanService], exports: [LedEventsService, NfcScanService] })
export class SharedModule {}
