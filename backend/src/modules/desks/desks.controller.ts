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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('desks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DesksController {
  constructor(private desks: DesksService) {}

  @Get('locations/:locationId/desks')
  @ApiOperation({ summary: 'List desks in location' })
  findAll(@Param('locationId') locationId: string) {
    return this.desks.findAll(locationId);
  }

  @Get('locations/:locationId/desks/status')
  @ApiOperation({ summary: 'Real-time occupancy map for location' })
  currentStatus(@Param('locationId') locationId: string) {
    return this.desks.getCurrentStatus(locationId);
  }

  @Get('desks/:id')
  @ApiOperation({ summary: 'Desk detail + upcoming reservations' })
  findOne(@Param('id') id: string) {
    return this.desks.findOne(id);
  }

  @Get('desks/:id/availability')
  @ApiOperation({ summary: 'Free slots for a given date' })
  @ApiQuery({ name: 'date', example: '2025-01-20' })
  availability(@Param('id') id: string, @Query('date') date: string) {
    return this.desks.getAvailability(id, date);
  }

  @Post('locations/:locationId/desks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create desk (Office Admin+)' })
  create(
    @Param('locationId') locationId: string,
    @Body() dto: CreateDeskDto,
  ) {
    return this.desks.create(locationId, dto);
  }

  @Patch('desks/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update desk' })
  update(@Param('id') id: string, @Body() dto: UpdateDeskDto) {
    return this.desks.update(id, dto);
  }

  @Delete('desks/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Deactivate desk' })
  remove(@Param('id') id: string) {
    return this.desks.remove(id);
  }
}
