import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Req, Res, Headers, HttpCode, HttpStatus, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request as ExpressRequest, Response } from 'express';
import { GatewaysService }          from './gateways.service';
import { GatewaySetupService }       from './gateway-setup.service';
import { GatewayAuthService }        from './gateway-auth.service';
import { GatewayCommandsService }    from './gateway-commands.service';
import { PrismaService }             from '../../database/prisma.service';
import { JwtAuthGuard }              from '../auth/guards/jwt-auth.guard';
import { RolesGuard }                from '../auth/guards/roles.guard';
import { Roles }                     from '../auth/decorators/roles.decorator';
import { GatewayJwtGuard }           from './guards/gateway-jwt.guard';
import { GatewayAuthDto }            from './dto/gateway-auth.dto';
import { GatewayAckDto }             from './dto/gateway-ack.dto';

@ApiTags('gateways')
@ApiBearerAuth()
@Controller('gateway')
export class GatewaysController {
  constructor(
    private svc:             GatewaysService,
    private setup:           GatewaySetupService,
    private gatewayAuth:     GatewayAuthService,
    private gatewayCommands: GatewayCommandsService,
    private prisma:          PrismaService,
  ) {}

  // ── HMAC → JWT exchange — called by gateway at startup and every 50 min ──
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange HMAC-SHA256 challenge for a short-lived gateway JWT' })
  async auth(@Body() dto: GatewayAuthDto) {
    const accessToken = await this.gatewayAuth.exchange(dto.gatewayId, dto.ts, dto.sig);
    return { accessToken, expiresIn: 3600 };
  }

  // ── SSE command channel — gateway connects here at startup ──────────
  @Get(':id/commands')
  @UseGuards(GatewayJwtGuard)
  @ApiOperation({ summary: 'SSE command stream — gateway connects here and listens for commands' })
  sseCommands(
    @Param('id')                              gatewayId: string,
    @Req()                                    req: ExpressRequest & { gatewayId: string },
    @Res({ passthrough: false })              res: Response,
  ): void {
    if (req.gatewayId !== gatewayId) {
      res.status(403).json({ error: 'forbidden: token does not match gateway id' });
      return;
    }

    res.setHeader('Content-Type',       'text/event-stream');
    res.setHeader('Cache-Control',      'no-cache');
    res.setHeader('Connection',         'keep-alive');
    res.setHeader('X-Accel-Buffering',  'no');
    res.flushHeaders();

    // Ping every 30s to prevent Cloudflare Tunnel idle timeout (~100s)
    const ping = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
    }, 30_000);

    this.gatewayCommands.registerConnection(gatewayId, res);

    req.on('close', () => {
      clearInterval(ping);
      this.gatewayCommands.removeConnection(gatewayId);
    });
  }

  // ── Beacon list — gateway fetches this on startup to restore known beacons ──
  @Get(':id/beacons')
  @UseGuards(GatewayJwtGuard)
  @ApiOperation({ summary: 'Return all beacons registered to this gateway (username + passwordHash + deskId)' })
  async gatewayBeacons(
    @Param('id') gatewayId: string,
    @Req()       req: ExpressRequest & { gatewayId: string },
  ) {
    if (req.gatewayId !== gatewayId) {
      throw new ForbiddenException('token does not match gateway id');
    }
    return this.prisma.device.findMany({
      where:  { gatewayId },
      select: { mqttUsername: true, mqttPasswordHash: true, deskId: true },
    });
  }

  // ── ACK — gateway confirms command execution ─────────────────
  @Post(':id/ack')
  @UseGuards(GatewayJwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gateway ACK for a previously received SSE command' })
  ack(
    @Param('id') gatewayId: string,
    @Req()       req: ExpressRequest & { gatewayId: string },
    @Body()      dto: GatewayAckDto,
  ): { received: boolean } {
    if (req.gatewayId !== gatewayId) {
      throw new ForbiddenException('token does not match gateway id');
    }
    this.gatewayCommands.handleAck(dto.nonce, dto.ok, dto.error);
    return { received: true };
  }

  // ── Gateway config — provision key auth — called by gateway Python ──
  @Get('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Return per-location LED config for gateway (x-gateway-provision-key required)' })
  async getLocationConfig(
    @Headers('x-gateway-id')            gwId:   string,
    @Headers('x-gateway-provision-key') secret: string,
  ) {
    const expected = process.env.GATEWAY_PROVISION_KEY ?? '';
    if (!expected || secret !== expected) throw new UnauthorizedException('Invalid provision key');

    const gw = await this.prisma.gateway.findUnique({
      where:  { id: gwId },
      select: { locationId: true },
    });
    if (!gw) throw new UnauthorizedException('Gateway not found');

    const location = await this.prisma.location.findUnique({
      where:  { id: gw.locationId },
      select: {
        ledColorFree:          true,
        ledColorOccupied:      true,
        ledColorReserved:      true,
        ledColorGuestReserved: true,
        ledBrightness:         true,
      },
    });

    return {
      ledColorFree:          location?.ledColorFree          ?? '#00C800',
      ledColorOccupied:      location?.ledColorOccupied      ?? '#DC0000',
      ledColorReserved:      location?.ledColorReserved      ?? '#0050DC',
      ledColorGuestReserved: location?.ledColorGuestReserved ?? '#C8A000',
      ledBrightness:         location?.ledBrightness         ?? 100,
    };
  }

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
  @UseGuards(GatewayJwtGuard)
  @ApiOperation({ summary: 'Sync reservations — called by gateway (JWT Bearer required)' })
  async sync(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { gatewayId: string },
  ) {
    if (req.gatewayId !== id) throw new ForbiddenException('token does not match gateway id');
    return this.svc.getSync(id);
  }

  @Post(':id/heartbeat')
  @UseGuards(GatewayJwtGuard)
  @ApiOperation({ summary: 'Gateway heartbeat (JWT Bearer required)' })
  async heartbeat(
    @Param('id') id: string,
    @Req()       req: ExpressRequest & { gatewayId: string },
    @Body('ipAddress') ipAddress?: string,
    @Body('version')   version?:   string,
  ) {
    if (req.gatewayId !== id) throw new ForbiddenException('token does not match gateway id');
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
  @ApiOperation({ summary: 'Trigger OTA update to latest release (manifest URL hardcoded in backend)' })
  update(@Param('id') id: string) {
    return this.svc.triggerUpdate(id);
  }

  // ── Device heartbeat (GatewayJwtGuard — beacon belongs to this gateway) ──
  @Patch('device/:deviceId/heartbeat')
  @UseGuards(GatewayJwtGuard)
  @ApiOperation({ summary: 'Beacon heartbeat — gateway JWT required' })
  async deviceHeartbeat(
    @Param('deviceId') deviceId: string,
    @Req()             req: ExpressRequest & { gatewayId: string },
    @Body('rssi') rssi?: number,
    @Body('firmwareVersion') firmwareVersion?: string,
    @Body('isOnline') isOnline?: boolean,
  ) {
    return this.svc.deviceHeartbeat(deviceId, rssi, firmwareVersion, isOnline, req.gatewayId);
  }
}
