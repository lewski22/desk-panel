import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DevicesService, ProvisionDeviceDto } from './devices.service';
import { MqttService }    from '../../mqtt/mqtt.service';
import { GatewaysService } from '../gateways/gateways.service';
import { TOPICS }       from '../../mqtt/topics';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

class SendCommandDto {
  command: 'SET_LED' | 'REBOOT' | 'IDENTIFY';
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
    private mqtt:     MqttService,
    private gateways: GatewaysService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all beacons' })
  findAll(@Query('gatewayId') gatewayId?: string) {
    return this.svc.findAll(gatewayId);
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
  @ApiOperation({ summary: 'Send REBOOT / IDENTIFY / SET_LED to beacon via gateway' })
  async command(@Param('id') id: string, @Body() dto: SendCommandDto) {
    // Komenda idzie: backend → gateway HTTP API → Pi Mosquitto → beacon
    // Nie używamy lokalnego mqtt.publish() — backend i beacony mają osobne brokery
    const device = await this.svc.findOne(id);
    const deskId = device.desk?.id ?? '';

    await this.gateways.sendBeaconCommand(
      device.gatewayId,
      deskId,
      dto.command,
      dto.params,
    );

    this.logger.log(`Command via gateway: ${dto.command} → beacon ${device.hardwareId}`);
    return { sent: true, command: dto.command, deskId, gatewayId: device.gatewayId };
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Assign beacon to a desk — sends SET_DESK_ID via gateway' })
  async assign(@Param('id') id: string, @Body('deskId') deskId: string) {
    const result = await this.svc.assignToDesk(id, deskId);
    const device = await this.svc.findOne(id);
    // SET_DESK_ID przez gateway HTTP — beacon zaktualizuje NVS i zrestartuje
    await this.gateways.sendBeaconCommand(
      device.gatewayId,
      device.deskId ?? '',   // stary deskId (stary topic beacona)
      'SET_DESK_ID',
      { desk_id: result.newDeskId },
    );
    this.logger.log(`SET_DESK_ID via gateway: ${device.hardwareId} → desk/${result.newDeskId}`);
    return result.updated;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Delete beacon' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
