import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }                           from '@nestjs/swagger';
import { UserRole }                                                       from '@prisma/client';
import { IsString, IsBoolean, IsOptional, IsArray, IsNotEmpty }            from 'class-validator';
import { OrganizationsService, CreateOrganizationDto, UpdateOrganizationDto } from './organizations.service';
import { AzureAuthService } from '../auth/azure-auth.service';
import { JwtAuthGuard }     from '../auth/guards/jwt-auth.guard';
import { RolesGuard }       from '../auth/guards/roles.guard';
import { Roles }            from '../auth/decorators/roles.decorator';

class UpdateAzureConfigDto {
  @IsOptional() @IsString()   azureTenantId?: string;
  @IsOptional() @IsBoolean()  azureEnabled?:  boolean;
}

class UpdateAmenitiesDto {
  @IsArray() @IsString({ each: true }) @IsNotEmpty({ each: true })
  amenities: string[];
}

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private svc:   OrganizationsService,
    private azure: AzureAuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations (Super Admin)' })
  findAll() { return this.svc.findAll(); }

  // ── Custom Amenities ───────────────────────────────────────
  // Static "me" routes must come before :id to avoid param capture

  @Get('me/amenities')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Get custom amenities for own organization' })
  getAmenities(@Request() req: any) {
    return this.svc.getCustomAmenities(req.user.organizationId);
  }

  @Put('me/amenities')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Replace custom amenities list for own organization' })
  updateAmenities(@Body() dto: UpdateAmenitiesDto, @Request() req: any) {
    return this.svc.updateCustomAmenities(req.user.organizationId, dto.amenities);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Usage stats for an organization' })
  stats(@Param('id') id: string) { return this.svc.getStats(id); }

  @Post()
  create(@Body() dto: CreateOrganizationDto) { return this.svc.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Aktualizuj organizację (tylko własna org dla SUPER_ADMIN)' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @Request() req: any) {
    this._assertSameOrg(id, req);
    return this.svc.update(id, dto);
  }

  // ── Password policy ───────────────────────────────────────
  // SUPER_ADMIN może resetować hasła wyłącznie własnej organizacji.
  // OWNER ma dostęp do dowolnej org (via RolesGuard hierarchy).

  @Post(':id/force-password-reset')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wymuś zmianę hasła dla użytkowników organizacji' })
  forcePasswordReset(@Param('id') id: string, @Request() req: any) {
    this._assertSameOrg(id, req);
    return this.svc.forcePasswordReset(id);
  }

  // ── M365 / Entra ID SSO ────────────────────────────────────
  // Zmianę konfiguracji M365 może wykonać:
  //   - SUPER_ADMIN: dla dowolnej organizacji
  //   - OFFICE_ADMIN: wyłącznie dla własnej organizacji

  @Get(':id/azure')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Pobierz konfigurację Azure SSO' })
  getAzureConfig(@Param('id') id: string, @Request() req: any) {
    this._assertOrgAccess(id, req);
    return this.azure.getOrgAzureConfig(id);
  }

  @Patch(':id/azure')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Zaktualizuj konfigurację Azure SSO (SUPER_ADMIN lub własna org)' })
  updateAzureConfig(
    @Param('id') id: string,
    @Body() dto: UpdateAzureConfigDto,
    @Request() req: any,
  ) {
    this._assertOrgAccess(id, req);
    return this.azure.updateOrgAzureConfig(id, dto);
  }

  // OFFICE_ADMIN może operować wyłącznie na własnej organizacji (SUPER_ADMIN — na wszystkich)
  private _assertOrgAccess(orgId: string, req: any) {
    if (
      req.user.role === UserRole.OFFICE_ADMIN &&
      req.user.organizationId !== orgId
    ) {
      throw new ForbiddenException('Brak dostępu do tej organizacji');
    }
  }

  // SUPER_ADMIN i OFFICE_ADMIN mogą operować wyłącznie na własnej organizacji; OWNER — bez ograniczeń
  private _assertSameOrg(orgId: string, req: any) {
    if (req.user.role === 'OWNER') return;
    if (req.user.organizationId !== orgId) {
      throw new ForbiddenException('Brak dostępu do tej organizacji');
    }
  }
}
