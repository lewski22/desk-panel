import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }                        from '@nestjs/swagger';
import { UserRole }                                                    from '@prisma/client';
import { LocationsService, CreateLocationDto }                         from './locations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private svc: LocationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  findAll(@Query('organizationId') orgId?: string) {
    return this.svc.findAll(orgId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/analytics/occupancy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Occupancy analytics for a location' })
  getOccupancyAnalytics(@Param('id') id: string) {
    return this.svc.getOccupancyAnalytics(id);
  }

  @Get(':id/analytics/extended')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Extended analytics: 7-day history, hourly, top desks, trend' })
  getExtendedAnalytics(@Param('id') id: string) {
    return this.svc.getAnalyticsExtended(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  create(@Body() dto: CreateLocationDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateLocationDto>) {
    return this.svc.update(id, dto);
  }
}
