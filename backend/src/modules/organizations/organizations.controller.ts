import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }                           from '@nestjs/swagger';
import { UserRole }                                                       from '@prisma/client';
import { IsString, IsBoolean, IsOptional }                                from 'class-validator';
import { OrganizationsService, CreateOrganizationDto, UpdateOrganizationDto } from './organizations.service';
import { AzureAuthService } from '../auth/azure-auth.service';
import { JwtAuthGuard }     from '../auth/guards/jwt-auth.guard';
import { RolesGuard }       from '../auth/guards/roles.guard';
import { Roles }            from '../auth/decorators/roles.decorator';

class UpdateAzureConfigDto {
  @IsOptional() @IsString()   azureTenantId?: string;
  @IsOptional() @IsBoolean()  azureEnabled?:  boolean;
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

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Usage stats for an organization' })
  stats(@Param('id') id: string) { return this.svc.getStats(id); }

  @Post()
  create(@Body() dto: CreateOrganizationDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.svc.update(id, dto);
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

  // OFFICE_ADMIN może operować wyłącznie na własnej organizacji
  private _assertOrgAccess(orgId: string, req: any) {
    if (
      req.user.role === UserRole.OFFICE_ADMIN &&
      req.user.organizationId !== orgId
    ) {
      throw new ForbiddenException('Brak dostępu do tej organizacji');
    }
  }
}
