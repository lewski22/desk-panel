// ── locations.module.ts ──────────────────────────────────────
import { Module }              from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { KioskController }     from './kiosk.controller';
import { LocationsService }    from './locations.service';

@Module({
  controllers: [LocationsController, KioskController],
  providers:   [LocationsService],
  exports:     [LocationsService],
})
export class LocationsModule {}
