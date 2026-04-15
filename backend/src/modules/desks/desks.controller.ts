import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DesksService } from './desks.service';
import { CreateDeskDto } from './dto/create-desk.dto';
import { UpdateDeskDto } from './dto/update-desk.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

@ApiTags('desks')
@Controller()
export class DesksController {
  constructor(private desks: DesksService) {}

  @Delete('desks/:id/permanent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Permanently delete INACTIVE desk' })
  hardDelete(@Param('id') id: string) {
    const orgId = req?.user?.role === 'OWNER' ? undefined : req?.user?.organizationId;
    return this.desks.hardDelete(id, orgId);
  }

  @Get('desks/available')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Wolne biurka na dany slot — dla Outlook Add-in (M3)' })
  @ApiQuery({ name: 'locationId', required: true })
  @ApiQuery({ name: 'date',       required: true, example: '2025-06-15' })
  @ApiQuery({ name: 'startTime',  required: true, example: '09:00' })
  @ApiQuery({ name: 'endTime',    required: true, example: '17:00' })
  findAvailable(
    @Query('locationId') locationId: string,
    @Query('date')       date:       string,
    @Query('startTime')  startTime:  string,
    @Query('endTime')    endTime:    string,
    @Request() req: any,
  ) {
    return this.desks.findAvailable(locationId, date, startTime, endTime, req.user.organizationId);
  }

  // ── Public — no auth ─────────────────────────────────────────
  @Get('desks/qr/:token')
  @ApiOperation({ summary: 'Desk info by QR token (public)' })
  getByQrToken(@Param('token') token: string) {
    return this.desks.getByQrToken(token);
  }

  // ── Protected ─────────────────────────────────────────────────
  @Get('locations/:locationId/desks')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List desks in location' })
  findAll(@Param('locationId') locationId: string) {
    return this.desks.findAll(locationId);
  }

  @Get('locations/:locationId/desks/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Real-time occupancy map for location' })
  currentStatus(@Param('locationId') locationId: string) {
    return this.desks.getCurrentStatus(locationId);
  }

  @Get('desks/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Desk detail + upcoming reservations' })
  findOne(@Param('id') id: string) {
    return this.desks.findOne(id);
  }

  @Get('desks/:id/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Free slots for a given date' })
  @ApiQuery({ name: 'date', example: '2025-01-20' })
  availability(@Param('id') id: string, @Query('date') date: string) {
    return this.desks.getAvailability(id, date);
  }

  @Post('locations/:locationId/desks')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create desk' })
  create(
    @Param('locationId') locationId: string,
    @Body() dto: CreateDeskDto,
  ) {
    return this.desks.create(locationId, dto);
  }

  @Patch('desks/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update desk' })
  update(@Param('id') id: string, @Body() dto: UpdateDeskDto) {
    const orgId = req?.user?.role === 'OWNER' ? undefined : req?.user?.organizationId;
    return this.desks.update(id, dto, orgId);
  }

  @Delete('desks/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Deactivate desk' })
  remove(@Param('id') id: string) {
    const orgId = req?.user?.role === 'OWNER' ? undefined : req?.user?.organizationId;
    return this.desks.remove(id, orgId);
  }

  @Patch('desks/:id/activate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Reactivate a deactivated desk' })
  activate(@Param('id') id: string) {
    const orgId = req?.user?.role === 'OWNER' ? undefined : req?.user?.organizationId;
    return this.desks.activate(id, orgId);
  }

  @Patch('desks/:id/unpair')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Unpair beacon from desk' })
  unassignDevice(@Param('id') id: string) {
    return this.desks.unassignDevice(id);
  }
}
