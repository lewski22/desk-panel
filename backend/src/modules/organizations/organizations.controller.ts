import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation }                           from '@nestjs/swagger';
import { UserRole }                                                       from '@prisma/client';
import { IsString, IsBoolean, IsOptional, IsArray, IsNotEmpty }            from 'class-validator';
import { OrganizationsService, CreateOrganizationDto, UpdateOrganizationDto } from './organizations.service';
import { AzureAuthService } from '../auth/azure-auth.service';
import { JwtAuthGuard }     from '../auth/guards/jwt-auth.guard';
import { RolesGuard }       from '../auth/guards/roles.guard';
import { Roles }            from '../auth/decorators/roles.decorator';

class SetWhitelabelDto {
  @IsBoolean() enabled: boolean;
}

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

  // ── Logo upload / delete ───────────────────────────────────
  // SUPER_ADMIN and OFFICE_ADMIN can upload / delete logo (prepare branding).
  // Logo is only displayed when whitelabelEnabled === true (controlled by OWNER).

  @Post(':id/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload org logo (max 512 KB, PNG/SVG/WEBP)' })
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('bgColor') bgColor: string | undefined,
    @Request() req: any,
  ) {
    this._assertOrgAccess(id, req);
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Unsupported file type');
    if (file.size > 512 * 1024) throw new BadRequestException('File too large (max 512 KB)');
    return this.svc.uploadLogo(id, file, bgColor);
  }

  @Delete(':id/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete org logo' })
  async deleteLogo(@Param('id') id: string, @Request() req: any) {
    this._assertOrgAccess(id, req);
    return this.svc.deleteLogo(id);
  }

  // ── White-label toggle — OWNER only ───────────────────────

  @Patch(':id/whitelabel')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Enable / disable white-label branding (OWNER only)' })
  async setWhitelabel(
    @Param('id') id: string,
    @Body() dto: SetWhitelabelDto,
  ): Promise<void> {
    await this.svc.setWhitelabel(id, dto.enabled);
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
