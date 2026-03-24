import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DevicesService, ProvisionDeviceDto } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/roles.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class SendCommandDto {
  command: 'SET_LED' | 'REBOOT' | 'IDENTIFY';
  params?: Record<string, any>;
}

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(private svc: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all beacons (filter by gatewayId)' })
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
  @ApiOperation({ summary: 'Send command to beacon via MQTT' })
  command(@Param('id') id: string, @Body() dto: SendCommandDto) {
    // MqttService will pick this up from the response and publish
    return this.svc.buildCommand(dto.command, dto.params);
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Assign beacon to a desk' })
  assign(@Param('id') id: string, @Body('deskId') deskId: string) {
    return this.svc.assignToDesk(id, deskId);
  }
}
