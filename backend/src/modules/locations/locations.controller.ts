import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }                        from '@nestjs/swagger';
import { UserRole }                                                    from '@prisma/client';
import { LocationsService, CreateLocationDto }                         from './locations.service';
import { JwtAuthGuard } from '../auth/guards/roles.guard';
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
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/occupancy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Today occupancy report' })
  occupancy(@Param('id') id: string) { return this.svc.getOccupancyReport(id); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  create(@Body() dto: CreateLocationDto) { return this.svc.create(dto); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateLocationDto>) {
    return this.svc.update(id, dto);
  }
}
