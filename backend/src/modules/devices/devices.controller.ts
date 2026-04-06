import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DevicesService, ProvisionDeviceDto } from './devices.service';
import { MqttService }  from '../../mqtt/mqtt.service';
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
    private svc:  DevicesService,
    private mqtt: MqttService,
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
  @ApiOperation({ summary: 'Send REBOOT / IDENTIFY / SET_LED to beacon via MQTT' })
  async command(@Param('id') id: string, @Body() dto: SendCommandDto) {
    const { topic, deskId } = await this.svc.getCommandTarget(id);
    const payload = { command: dto.command, params: dto.params, ts: Date.now() };
    this.mqtt.publish(topic, payload);
    this.logger.log(`Command → ${topic}: ${dto.command}`);
    return { sent: true, command: dto.command, deskId };
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Assign beacon to a desk — sends SET_DESK_ID to beacon' })
  async assign(@Param('id') id: string, @Body('deskId') deskId: string) {
    const result = await this.svc.assignToDesk(id, deskId);
    // Wyślij SET_DESK_ID na stary topic beacona — beacon zaktualizuje NVS i zrestartuje
    this.mqtt.publish(result.setDeskIdTopic, {
      command: 'SET_DESK_ID',
      params:  { desk_id: result.newDeskId },
      ts:      Date.now(),
    });
    this.logger.log(`SET_DESK_ID → ${result.setDeskIdTopic}: ${result.newDeskId}`);
    return result.updated;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Delete beacon' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
