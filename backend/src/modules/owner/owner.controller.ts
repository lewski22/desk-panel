import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../auth/guards/jwt-auth.guard';
import { OwnerGuard }        from './guards/owner.guard';
import { OwnerService }      from './owner.service';
import { OwnerHealthService }from './owner-health.service';
import { CreateOrgDto }      from './dto/create-org.dto';
import { UpdateOrgDto }      from './dto/update-org.dto';
import { SetModulesDto }     from './dto/set-modules.dto';

@ApiTags('owner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnerGuard)
@Controller('owner')
export class OwnerController {
  constructor(
    private svc:    OwnerService,
    private health: OwnerHealthService,
  ) {}

  // ── Organizacje ───────────────────────────────────────────────

  @Get('organizations')
  @ApiOperation({ summary: 'Lista wszystkich firm z metrykami' })
  getOrganizations(
    @Query('isActive') isActive?: string,
    @Query('plan')     plan?: string,
    @Query('search')   search?: string,
  ) {
    return this.svc.getOrganizations({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      plan,
      search,
    });
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Utwórz nową firmę + pierwszego SUPER_ADMIN' })
  createOrganization(@Body() dto: CreateOrgDto, @Request() req: any) {
    return this.svc.createOrganization(dto, req.user.id);
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Szczegóły firmy: biura, gateway, beacony, aktywność' })
  getOrganization(@Param('id') id: string) {
    return this.svc.getOrganization(id);
  }

  @Patch('organizations/:id')
  @ApiOperation({ summary: 'Edytuj firmę (plan, status, notatki)' })
  updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrgDto) {
    if (dto.enabledModules !== undefined) {
      const VALID = ['DESKS', 'BEACONS', 'ROOMS', 'PARKING', 'FLOOR_PLAN', 'WEEKLY_VIEW', 'EQUIPMENT'];
      dto.enabledModules = dto.enabledModules.filter((m: string) => VALID.includes(m));
      if (dto.enabledModules.includes('BEACONS') && !dto.enabledModules.includes('DESKS')) {
        throw new BadRequestException('Moduł BEACONS wymaga aktywnego modułu DESKS');
      }
    }
    return this.svc.updateOrganization(id, dto);
  }

  // ── Module management — Sprint E ─────────────────────────────
  @Patch('organizations/:id/modules')
  @ApiOperation({ summary: 'Ustaw aktywne moduły dla organizacji (Owner)' })
  setModules(
    @Param('id')  id:   string,
    @Body()       body: SetModulesDto,
  ) {
    const VALID = ['DESKS', 'BEACONS', 'ROOMS', 'PARKING', 'FLOOR_PLAN', 'WEEKLY_VIEW', 'EQUIPMENT'];
    const modules = (body.enabledModules ?? []).filter((m: string) => VALID.includes(m));
    if (modules.includes('BEACONS') && !modules.includes('DESKS')) {
      throw new BadRequestException('Moduł BEACONS wymaga aktywnego modułu DESKS');
    }
    return this.svc.updateOrganization(id, { enabledModules: modules });
  }

  @Delete('organizations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dezaktywuj firmę (soft delete, isActive=false)' })
  deactivateOrganization(@Param('id') id: string) {
    return this.svc.deactivateOrganization(id);
  }

  @Post('organizations/:id/impersonate')
  @ApiOperation({ summary: 'Wejdź jako SUPER_ADMIN firmy (JWT 30 min, audit trail)' })
  impersonate(@Param('id') id: string, @Request() req: any) {
    const ip = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    return this.svc.impersonate(id, req.user.id, ip);
  }

  @Post('organizations/:id/force-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wymuś zmianę hasła dla wszystkich użytkowników wybranej org (OWNER)' })
  forcePasswordReset(@Param('id') id: string) {
    return this.svc.forcePasswordReset(id);
  }

  @Post('force-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wymuś zmianę hasła dla WSZYSTKICH użytkowników na platformie (OWNER)' })
  forcePasswordResetAll() {
    return this.svc.forcePasswordResetAll();
  }

  // ── Health / monitoring ───────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Globalny stan gateway i beaconów' })
  getGlobalHealth(
    @Query('status') status?: string,
    @Query('orgId')  orgId?:  string,
  ) {
    return this.health.getGlobalHealth({ status, orgId });
  }

  @Get('health/:orgId')
  @ApiOperation({ summary: 'Stan infrastruktury jednej firmy' })
  getOrgHealth(@Param('orgId') orgId: string) {
    return this.health.getOrgHealth(orgId);
  }

  // ── Statystyki platformy ──────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Metryki platformy: firmy, gateway, beacony, check-iny' })
  getStats() {
    return this.svc.getStats();
  }
}
