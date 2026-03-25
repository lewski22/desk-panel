import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GatewaysService } from './gateways.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('gateways')
@ApiBearerAuth()
@Controller('gateway')
export class GatewaysController {
  constructor(private svc: GatewaysService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  findAll(@Query('locationId') locationId?: string) {
    return this.svc.findAll(locationId);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Register new gateway — returns secret (once)' })
  register(
    @Body('locationId') locationId: string,
    @Body('name') name: string,
  ) {
    return this.svc.register(locationId, name);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Full sync — gateway pulls reservations for today' })
  sync(@Param('id') id: string) {
    return this.svc.getSync(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Gateway heartbeat — marks as online' })
  heartbeat(
    @Param('id') id: string,
    @Body('ipAddress') ipAddress?: string,
  ) {
    return this.svc.heartbeat(id, ipAddress);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Delete gateway' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
