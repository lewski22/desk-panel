import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request,
  UseGuards, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';
import { DevicesService, ProvisionDeviceDto } from './devices.service';
import { GatewaysService } from '../gateways/gateways.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

class SendCommandDto {
  @ApiProperty({ enum: ['REBOOT', 'IDENTIFY', 'SET_LED'] })
  @IsString()
  @IsIn(['REBOOT', 'IDENTIFY', 'SET_LED'])
  command: 'SET_LED' | 'REBOOT' | 'IDENTIFY';

  @ApiPropertyOptional()
  @IsOptional()
  params?: Record<string, any>;
}

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(
    private svc:      DevicesService,
    private gateways: GatewaysService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all beacons (filtered by org for non-OWNER)' })
  findAll(@Request() req: any) {
    // OWNER widzi wszystko; SUPER_ADMIN/OFFICE_ADMIN tylko swoją org
    const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findAll(orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post('provision')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Provision new beacon — returns MQTT credentials (once)' })
  provision(@Body() dto: ProvisionDeviceDto) {
    return this.svc.provision(dto);
  }

  @Post(':id/command')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Send REBOOT / IDENTIFY / SET_LED to beacon via gateway — org-isolated' })
  async command(@Param('id') id: string, @Body() dto: SendCommandDto, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    // assertBelongsToOrg — throws ForbiddenException jeśli beacon nie jest z tej org
    const device = actorOrgId
      ? await this.svc.assertBelongsToOrg(id, actorOrgId)
      : await this.svc.findOne(id);
    const deskId = device.desk?.id ?? '';

    await this.gateways.sendBeaconCommand(
      device.gatewayId ?? '',
      deskId,
      dto.command,
      dto.params,
    );

    this.logger.log(`Command via gateway: ${dto.command} → beacon ${device.hardwareId}`);
    return { sent: true, command: dto.command, deskId, gatewayId: device.gatewayId };
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Assign beacon to a desk — org-isolated' })
  async assign(@Param('id') id: string, @Body('deskId') deskId: string, @Request() req: any) {
    // Org guard: beacon I biurko muszą należeć do tej samej org
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    if (actorOrgId) await this.svc.assertBelongsToOrg(id, actorOrgId);
    // Pobierz stary deskId PRZED update — komenda musi iść na STARY topic
    // (beacon słucha na desk/{oldDeskId}/command dopóki nie zrestartuje z nowym NVS)
    const deviceBefore = await this.svc.findOne(id);
    const oldDeskId    = deviceBefore.deskId ?? '';   // stary topic beacona
    const gatewayId    = deviceBefore.gatewayId ?? '';

    // Aktualizuj DB
    const result = await this.svc.assignToDesk(id, deskId);

    if (oldDeskId) {
      // Wyślij SET_DESK_ID na STARY topic — beacon zrestartuje i zacznie słuchać nowego
      // Gateway jednocześnie zaktualizuje swój SQLite cache (desk_id) przez /command handler
      await this.gateways.sendBeaconCommand(
        gatewayId,
        oldDeskId,      // ← stary topic, na którym beacon aktualnie słucha
        'SET_DESK_ID',
        { desk_id: deskId, gateway_update: true },
      );
      this.logger.log(
        `SET_DESK_ID via gateway: ${deviceBefore.hardwareId}` +
        ` | old: desk/${oldDeskId}/command` +
        ` | new deskId: ${deskId}`
      );
    } else {
      // Beacon nie miał przypisanego biurka — nie możemy wysłać komendy MQTT
      // Trzeba będzie przeprovisionować fizycznie przez Serial
      this.logger.warn(
        `Beacon ${deviceBefore.hardwareId} nie miał deskId — SET_DESK_ID przez MQTT niemożliwe. Reprovisioning przez Serial wymagany.`
      );
    }

    return result.updated;
  }

  @Get('firmware/latest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Get latest firmware version from GitHub Releases' })
  async firmwareLatest() {
    return this.svc.getLatestFirmware();
  }

  @Post(':id/ota')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Trigger OTA firmware update (org-isolated)' })
  async triggerOta(@Param('id') id: string, @Request() req: any) {
    // OWNER może aktualizować wszystko; SUPER_ADMIN/OFFICE_ADMIN — tylko własna org
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    const result = await this.svc.triggerOta(id, actorOrgId);

    // Wyślij OTA_UPDATE przez gateway HTTP → Mosquitto → beacon
    await this.gateways.sendBeaconCommand(
      result.gatewayId ?? '',
      result.deskId    ?? '',
      result._ota_payload.command,
      result._ota_payload.params,
    );

    const { _ota_payload: _, ...response } = result;
    return response;
  }

  @Post('ota-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Trigger OTA for all outdated beacons in org (5s throttle)' })
  async triggerOtaAll(
    @Request() req:              any,
    @Body('locationId') locationId?: string,
  ) {
    if (req.user.role === 'OWNER') {
      // Owner zarządza przez OwnerPage — ten endpoint tylko dla org-scoped ról
      return { error: 'OWNER powinien używać panelu zarządzania firmami' };
    }
    const actorOrgId = req.user.organizationId;
    if (!actorOrgId) return { queued: 0, error: 'Brak organizacji' };

    this.logger.log(\`OTA-all requested by \${req.user.email} (org: \${actorOrgId})\`);
    return this.svc.triggerOtaAll(actorOrgId, locationId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Delete beacon — org-isolated' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    if (actorOrgId) await this.svc.assertBelongsToOrg(id, actorOrgId);
    return this.svc.remove(id);
  }
}
