/**
 * InsightsController — Sprint K2
 *
 * GET /insights?locationId=   — insighty per lokalizacja
 * GET /insights/org            — insighty per org (OWNER/SUPER_ADMIN)
 * POST /insights/refresh        — ręczne odświeżenie (OFFICE_ADMIN+)
 *
 * backend/src/modules/insights/insights.controller.ts
 */
import {
  Controller, Get, Post, Query, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }   from '../auth/guards/jwt-auth.guard';
import { RolesGuard }     from '../auth/guards/roles.guard';
import { Roles }          from '../auth/decorators/roles.decorator';
import { InsightsService } from './insights.service';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly svc: InsightsService) {}

  @Get()
  @Roles('OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Insighty zajętości per lokalizacja (K2)' })
  async getForLocation(
    @Query('locationId') locationId: string,
    @Request()           req:        any,
  ) {
    if (!locationId) return { insights: [] };
    const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    const items = await this.svc.getForLocation(locationId, orgId);
    return { locationId, insights: items };
  }

  @Get('org')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Insighty dla wszystkich lokalizacji orga (OWNER)' })
  async getForOrg(
    @Query('orgId') orgId: string | undefined,
    @Request()      req:   any,
  ) {
    const resolvedOrgId = req.user.role === 'OWNER' && orgId
      ? orgId
      : req.user.organizationId;
    if (!resolvedOrgId) return { locations: [] };
    const locations = await this.svc.getForOrg(resolvedOrgId);
    return { locations };
  }

  @Post('refresh-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Trigger insight generation for all locations (useful for first run)' })
  async refreshAll() {
    await this.svc.cronGenerateAll();
    return { triggered: true };
  }

  @Post('refresh')
  @Roles('OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Ręczne odświeżenie insightów (pomija cache TTL)' })
  async refresh(
    @Query('locationId') locationId: string,
    @Request()           req:        any,
  ) {
    if (!locationId) throw new ForbiddenException('locationId required');
    const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    const items = await this.svc.getForLocation(locationId, orgId);
    return { locationId, insights: items, refreshed: true };
  }
}
