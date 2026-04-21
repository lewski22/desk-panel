import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation }         from '@nestjs/swagger';
import { LocationsService }              from './locations.service';

/**
 * Publiczny endpoint kiosku — bez JWT guard.
 * Kiosk działa na tablecie bez logowania użytkownika;
 * PIN jest jedynym mechanizmem wyjścia z trybu kiosku.
 */
@ApiTags('kiosk')
@Controller('locations')
export class KioskController {
  constructor(private readonly svc: LocationsService) {}

  @Post(':id/kiosk/verify-pin')
  @ApiOperation({ summary: 'Verify kiosk exit PIN — public, no JWT required' })
  verifyPin(
    @Param('id') id: string,
    @Body() body: { pin: string },
  ) {
    return this.svc.verifyKioskPin(id, body.pin ?? '');
  }
}
