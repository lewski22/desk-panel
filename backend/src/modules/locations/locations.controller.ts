import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  findAll(@Query('organizationId') orgId?: string, @Request() req?: any) {
    // OFFICE_ADMIN: always scoped to their org; SUPER_ADMIN: can filter or see all
    const effectiveOrgId = req?.user?.role === UserRole.OFFICE_ADMIN
      ? req.user.organizationId
      : orgId;
    return this.svc.findAll(effectiveOrgId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const loc = await this.svc.findOne(id);
    // OFFICE_ADMIN i STAFF mogą widzieć tylko lokalizacje swojej organizacji
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.organizationId &&
      loc?.organizationId !== req.user.organizationId
    ) {
      throw new ForbiddenException('Brak dostępu do tej lokalizacji');
    }
    return loc;
  }

  @Get(':id/analytics/occupancy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Occupancy analytics for a location — org-isolated' })
  async getOccupancyAnalytics(@Param('id') id: string, @Request() req: any) {
    // Org guard — zweryfikuj dostęp do tej lokalizacji
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Brak dostępu do tej lokalizacji');
      }
    }
    return this.svc.getOccupancyAnalytics(id);
  }

  @Get(':id/analytics/extended')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Extended analytics — org-isolated' })
  async getExtendedAnalytics(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Brak dostępu do tej lokalizacji');
      }
    }
    return this.svc.getAnalyticsExtended(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  create(@Body() dto: CreateLocationDto, @Request() req: any) {
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== 'OWNER') {
      dto = { ...dto, organizationId: req.user.organizationId };
    }
    return this.svc.create(dto);
  }

  @Get(':id/issues')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Today issues widget — beacons offline, long checkins, OTA failed, no-checkins' })
  async getTodayIssues(@Param('id') id: string, @Request() req: any) {
    // Org guard
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Brak dostępu do tej lokalizacji');
      }
    }
    return this.svc.getTodayIssues(id);
  }

  // ── Sprint E1: Weekly Attendance endpoint ────────────────────
  @Get(':id/attendance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Weekly attendance grid — kto kiedy w biurze (Sprint E1)' })
  async getAttendance(
    @Param('id')         id:   string,
    @Query('week')       week: string,
    @Request()           req:  any,
  ) {
    return this.svc.getAttendance(id, week ?? '');
  }

  // ── Sprint D: Floor Plan endpoints ──────────────────────────
  @Get(':id/floor-plan')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Get floor plan metadata for location' })
  async getFloorPlan(@Param('id') id: string) {
    return this.svc.getFloorPlan(id);
  }

  @Post(':id/floor-plan')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Upload floor plan image (base64 PNG/SVG, max 2MB)' })
  async uploadFloorPlan(
    @Param('id') id: string,
    @Body() body: { floorPlanUrl: string; floorPlanW?: number; floorPlanH?: number; gridSize?: number },
    @Request() req: any,
  ) {
    // Org guard
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Brak dostępu do tej lokalizacji');
      }
    }
    return this.svc.uploadFloorPlan(id, body);
  }

  @Post(':id/floor-plan/delete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Remove floor plan image' })
  async deleteFloorPlan(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) throw new ForbiddenException('Brak dostępu');
    }
    return this.svc.deleteFloorPlan(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateLocationDto>, @Request() req: any) {
    // Org guard — OFFICE_ADMIN nie może edytować lokalizacji innej org
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
      const loc = await this.svc.findOne(id);
      if (loc.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Brak dostępu do tej lokalizacji');
      }
    }
    return this.svc.update(id, dto);
  }
}
