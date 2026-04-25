import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Headers, UnauthorizedException } from '@nestjs/common';
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
  findAll(@Query('locationId') locationId?: string, @Request() req?: any) {
    // OWNER widzi wszystko; inni — tylko gatewaye swojej org
    const actorOrgId = req?.user?.role === 'OWNER' ? undefined : req?.user?.organizationId;
    return this.svc.findAll(locationId, actorOrgId);
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
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.setup.createToken(locationId, req.user.id, actorOrgId);
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
  @ApiOperation({ summary: 'Sync reservations — called by gateway (x-gateway-secret required)' })
  async sync(
    @Param('id') id: string,
    @Headers('x-gateway-secret') secret?: string,
  ) {
    if (!secret) throw new UnauthorizedException('Missing x-gateway-secret');
    await this.svc.authenticate(id, secret);
    return this.svc.getSync(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Gateway heartbeat (x-gateway-secret required)' })
  async heartbeat(
    @Param('id') id: string,
    @Headers('x-gateway-secret') secret?: string,
    @Body('ipAddress') ipAddress?: string,
    @Body('version')   version?:   string,
  ) {
    if (!secret) throw new UnauthorizedException('Missing x-gateway-secret');
    await this.svc.authenticate(id, secret);
    return this.svc.heartbeat(id, ipAddress, version);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.remove(id, actorOrgId);
  }

  @Post(':id/rotate-secret')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Rotate gateway secret — 15min overlap window, auto-push to gateway' })
  rotateSecret(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.rotateSecret(id, actorOrgId);
  }

  @Post(':id/regenerate-secret')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Legacy — delegates to rotate-secret' })
  regenerateSecret(@Param('id') id: string) {
    return this.svc.regenerateSecret(id);
  }

  @Post(':id/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Trigger OTA update of gateway software' })
  update(
    @Param('id') id: string,
    @Body('channel') channel?: string,
  ) {
    return this.svc.triggerUpdate(id, channel ?? 'main');
  }

  // ── Device heartbeat (x-gateway-provision-key required) ───────
  @Patch('device/:deviceId/heartbeat')
  @ApiOperation({ summary: 'Beacon heartbeat — GATEWAY_PROVISION_KEY required' })
  async deviceHeartbeat(
    @Param('deviceId') deviceId: string,
    @Headers('x-gateway-provision-key') provKey?: string,
    @Body('rssi') rssi?: number,
    @Body('firmwareVersion') firmwareVersion?: string,
    @Body('isOnline') isOnline?: boolean,
  ) {
    const expected = process.env.GATEWAY_PROVISION_KEY ?? '';
    if (!expected || provKey !== expected) throw new UnauthorizedException('Invalid provision key');
    return this.svc.deviceHeartbeat(deviceId, rssi, firmwareVersion, isOnline);
  }
}
