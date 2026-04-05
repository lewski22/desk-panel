import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GatewaysService }     from './gateways.service';
import { GatewaySetupService } from './gateway-setup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

@ApiTags('gateways')
@ApiBearerAuth()
@Controller('gateway')
export class GatewaysController {
  constructor(
    private svc:   GatewaysService,
    private setup: GatewaySetupService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  findAll(@Query('locationId') locationId?: string) {
    return this.svc.findAll(locationId);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Register new gateway manually' })
  register(@Body('locationId') locationId: string, @Body('name') name: string) {
    return this.svc.register(locationId, name);
  }

  // ── Setup tokens ─────────────────────────────────────────────

  @Post('setup-tokens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Generate one-time install token (24h)' })
  createSetupToken(@Body('locationId') locationId: string, @Request() req: any) {
    return this.setup.createToken(locationId, req.user.id);
  }

  @Get('setup-tokens/:locationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'List setup tokens for a location' })
  listSetupTokens(@Param('locationId') locationId: string) {
    return this.setup.listTokens(locationId);
  }

  @Delete('setup-tokens/:tokenId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Revoke a setup token' })
  revokeSetupToken(@Param('tokenId') tokenId: string) {
    return this.setup.revokeToken(tokenId);
  }

  // PUBLIC — skrypt instalacyjny — nie wymaga JWT
  @Post('setup/:token')
  @ApiOperation({ summary: 'Redeem token — called by install.sh (public, one-time)' })
  redeemSetupToken(
    @Param('token') token: string,
    @Body('gatewayName') gatewayName?: string,
  ) {
    return this.setup.redeemToken(token, gatewayName ?? '');
  }

  // ── Standard endpoints ───────────────────────────────────────

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync reservations — called by gateway' })
  sync(@Param('id') id: string) {
    return this.svc.getSync(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Gateway heartbeat' })
  heartbeat(@Param('id') id: string, @Body('ipAddress') ipAddress?: string) {
    return this.svc.heartbeat(id, ipAddress);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/regenerate-secret')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  regenerateSecret(@Param('id') id: string) {
    return this.svc.regenerateSecret(id);
  }

  // ── Device heartbeat (called by gateway, no JWT) ──────────────
  @Patch('device/:hardwareId/heartbeat')
  @ApiOperation({ summary: 'Beacon heartbeat — called by gateway, no auth required' })
  deviceHeartbeat(
    @Param('hardwareId') hardwareId: string,
    @Body('rssi') rssi?: number,
    @Body('firmwareVersion') firmwareVersion?: string,
    @Body('isOnline') isOnline?: boolean,
  ) {
    return this.svc.deviceHeartbeat(hardwareId, rssi, firmwareVersion, isOnline);
  }
}
