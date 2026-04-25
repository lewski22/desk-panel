// ── locations.module.ts ──────────────────────────────────────
import { Module }              from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { KioskController }     from './kiosk.controller';
import { LocationsService }    from './locations.service';
import { WifiCryptoService }   from '../crypto/wifi-crypto.service';

@Module({
  controllers: [LocationsController, KioskController],
  providers:   [LocationsService, WifiCryptoService],
  exports:     [LocationsService, WifiCryptoService],
})
export class LocationsModule {}
