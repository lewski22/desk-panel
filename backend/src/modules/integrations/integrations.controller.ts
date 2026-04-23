/**
 * IntegrationsController — Sprint F0+F1+F2+F3+F4+F5
 *
 * GET    /integrations              — lista integracji org (SUPER_ADMIN)
 * GET    /integrations/:provider    — jedna integracja
 * PUT    /integrations/:provider    — zapisz konfigurację + test opcjonalny
 * PATCH  /integrations/:provider/toggle — włącz/wyłącz
 * DELETE /integrations/:provider    — usuń konfigurację
 * POST   /integrations/:provider/test — test połączenia
 *
 * Izolacja org: actorOrgId ZAWSZE z JWT, nigdy z requestu.
 *
 * backend/src/modules/integrations/integrations.controller.ts
 */
import {
  Controller, Get, Put, Patch, Delete, Post,
  Param, Body, UseGuards, Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../auth/guards/jwt-auth.guard';
import { RolesGuard }        from '../auth/guards/roles.guard';
import { Roles }             from '../auth/decorators/roles.decorator';
import { IntegrationsService }      from './integrations.service';
import { UpsertIntegrationDto }    from './dto/upsert-integration.dto';
import { AzureProvider }     from './providers/azure.provider';
import { SlackProvider }     from './providers/slack.provider';
import { GoogleProvider }    from './providers/google.provider';
import { TeamsProvider }     from './providers/teams.provider';
import { WebhookProvider }   from './providers/webhook.provider';

const VALID_PROVIDERS = ['AZURE_ENTRA','SLACK','GOOGLE_WORKSPACE','MICROSOFT_TEAMS','WEBHOOK_CUSTOM'];

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly svc:     IntegrationsService,
    private readonly azure:   AzureProvider,
    private readonly slack:   SlackProvider,
    private readonly google:  GoogleProvider,
    private readonly teams:   TeamsProvider,
    private readonly webhook: WebhookProvider,
  ) {}

  // ── Lista integracji ─────────────────────────────────────────
  @Get()
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Pobierz wszystkie integracje organizacji' })
  async findAll(@Request() req: any) {
    const orgId = this._resolveOrgId(req);
    return this.svc.findAll(orgId);
  }

  // ── Jedna integracja ─────────────────────────────────────────
  @Get(':provider')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Pobierz konfigurację integracji' })
  async findOne(@Param('provider') provider: string, @Request() req: any) {
    this._validateProvider(provider);
    const orgId = this._resolveOrgId(req);
    return this.svc.findOne(orgId, provider as any);
  }

  // ── Zapisz/zaktualizuj konfigurację ─────────────────────────
  @Put(':provider')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Zapisz konfigurację integracji (upsert)' })
  async upsert(
    @Param('provider') provider: string,
    @Body() body: UpsertIntegrationDto,
    @Request() req: any,
  ) {
    this._validateProvider(provider);
    const orgId = this._resolveOrgId(req);

    if (!body.config || typeof body.config !== 'object') {
      throw new BadRequestException('config jest wymagany');
    }

    return this.svc.upsert(
      orgId,
      provider as any,
      body.config as any,
      {
        displayName: body.displayName,
        tenantHint:  body.tenantHint,
        isEnabled:   body.isEnabled,
      },
    );
  }

  // ── Toggle isEnabled ─────────────────────────────────────────
  @Patch(':provider/toggle')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Włącz lub wyłącz integrację' })
  async toggle(
    @Param('provider') provider: string,
    @Body('isEnabled') isEnabled: boolean,
    @Request() req: any,
  ) {
    this._validateProvider(provider);
    const orgId = this._resolveOrgId(req);
    return this.svc.toggle(orgId, provider as any, !!isEnabled);
  }

  // ── Usuń konfigurację ────────────────────────────────────────
  @Delete(':provider')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Usuń konfigurację integracji' })
  async remove(@Param('provider') provider: string, @Request() req: any) {
    this._validateProvider(provider);
    const orgId = this._resolveOrgId(req);
    return this.svc.remove(orgId, provider as any);
  }

  // ── Test połączenia ──────────────────────────────────────────
  @Post(':provider/test')
  @Roles('OWNER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Przetestuj konfigurację integracji' })
  async test(@Param('provider') provider: string, @Request() req: any) {
    this._validateProvider(provider);
    const orgId = this._resolveOrgId(req);

    let result: { ok: boolean; message: string };

    switch (provider as any) {
      case 'AZURE_ENTRA':
        result = await this.azure.test(orgId);
        break;
      case 'SLACK':
        result = await this.slack.test(orgId);
        break;
      case 'GOOGLE_WORKSPACE':
        result = await this.google.test(orgId);
        break;
      case 'MICROSOFT_TEAMS':
        result = await this.teams.test(orgId);
        break;
      case 'WEBHOOK_CUSTOM':
        result = await this.webhook.test(orgId);
        break;
      default:
        result = { ok: false, message: 'Nieznany provider' };
    }

    // Zapisz wynik testu w DB
    await this.svc.updateTestResult(orgId, provider as any, result.ok, result.ok ? undefined : result.message);
    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────
  private _resolveOrgId(req: any): string {
    // OWNER może podać orgId przez query/body — ale i tak sprawdzamy
    // SUPER_ADMIN widzi tylko swoją org
    const role  = req.user?.role;
    const orgId = req.user?.organizationId;
    if (role === 'OWNER') {
      // OWNER może zarządzać dowolną org — orgId z JWT dla własnej
      return orgId ?? '';
    }
    if (!orgId) throw new BadRequestException('Brak organizationId w tokenie');
    return orgId;
  }

  private _validateProvider(provider: string) {
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Nieznany provider: ${provider}. Dostępne: ${VALID_PROVIDERS.join(', ')}`);
    }
  }
}
