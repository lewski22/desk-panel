/**
 * IntegrationsService — Sprint F0
 *
 * CRUD konfiguracji integracji per organizacja.
 * Izolacja org: actorOrgId zawsze z JWT, nigdy z request params.
 * Szyfrowanie: AES-256-GCM przez IntegrationCryptoService.
 *
 * backend/src/modules/integrations/integrations.service.ts
 */
import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService }            from '../../database/prisma.service';
import { IntegrationCryptoService } from './integration-crypto.service';
import { assertPublicWebhookUrl } from './providers/webhook-url-guard';
import type {
  AnyIntegrationConfig,
  IntegrationPublicView,
  AzureEntraConfig,
  SlackConfig,
  GoogleWorkspaceConfig,
  MicrosoftTeamsConfig,
  WebhookCustomConfig,
} from './types/integration-config.types';

type Provider = 'AZURE_ENTRA' | 'SLACK' | 'GOOGLE_WORKSPACE' | 'MICROSOFT_TEAMS' | 'WEBHOOK_CUSTOM';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly crypto:  IntegrationCryptoService,
  ) {}

  // ── Pobierz wszystkie integracje dla org ─────────────────────
  async findAll(orgId: string): Promise<IntegrationPublicView[]> {
    const records = await (this.prisma as any).orgIntegration.findMany({
      where:   { organizationId: orgId },
      orderBy: { provider: 'asc' },
    });
    return records.map((r: any) => this._toPublicView(r));
  }

  // ── Pobierz jedną integrację ─────────────────────────────────
  async findOne(orgId: string, provider: Provider): Promise<IntegrationPublicView | null> {
    const r = await this._findRecord(orgId, provider);
    if (!r) return null;
    return this._toPublicView(r);
  }

  // ── Zapisz/zaktualizuj konfigurację ─────────────────────────
  async upsert(
    orgId:    string,
    provider: Provider,
    config:   AnyIntegrationConfig,
    opts?: { displayName?: string; tenantHint?: string; isEnabled?: boolean },
  ): Promise<IntegrationPublicView> {
    if (provider === 'WEBHOOK_CUSTOM') {
      const webhookCfg = config as WebhookCustomConfig;
      if (webhookCfg.url) assertPublicWebhookUrl(webhookCfg.url);
    }

    const configEncrypted = this.crypto.encryptJson(config);

    const record = await (this.prisma as any).orgIntegration.upsert({
      where:  { organizationId_provider: { organizationId: orgId, provider } },
      update: {
        configEncrypted,
        displayName:  opts?.displayName,
        tenantHint:   opts?.tenantHint,
        isEnabled:    opts?.isEnabled ?? false,
        lastTestOk:   null, // reset po zmianie konfiguracji
        lastTestError: null,
        updatedAt:    new Date(),
      },
      create: {
        organizationId: orgId,
        provider,
        configEncrypted,
        displayName:  opts?.displayName ?? null,
        tenantHint:   opts?.tenantHint ?? null,
        isEnabled:    opts?.isEnabled ?? false,
      },
    });

    this.logger.log(`Integration upserted: org=${orgId} provider=${provider}`);
    return this._toPublicView(record);
  }

  // ── Toggle isEnabled ─────────────────────────────────────────
  async toggle(orgId: string, provider: Provider, isEnabled: boolean): Promise<IntegrationPublicView> {
    const record = await this._findRecord(orgId, provider);
    if (!record) {
      throw new NotFoundException(`Integracja ${provider} nie skonfigurowana`);
    }

    const updated = await (this.prisma as any).orgIntegration.update({
      where: { organizationId_provider: { organizationId: orgId, provider } },
      data:  { isEnabled, updatedAt: new Date() },
    });

    this.logger.log(`Integration ${isEnabled ? 'enabled' : 'disabled'}: org=${orgId} provider=${provider}`);
    return this._toPublicView(updated);
  }

  // ── Usuń integrację ──────────────────────────────────────────
  async remove(orgId: string, provider: Provider): Promise<{ deleted: boolean }> {
    const record = await this._findRecord(orgId, provider);
    if (!record) throw new NotFoundException(`Integracja ${provider} nie istnieje`);

    await (this.prisma as any).orgIntegration.delete({
      where: { organizationId_provider: { organizationId: orgId, provider } },
    });

    this.logger.log(`Integration removed: org=${orgId} provider=${provider}`);
    return { deleted: true };
  }

  // ── Zaktualizuj wynik testu ──────────────────────────────────
  async updateTestResult(
    orgId:    string,
    provider: Provider,
    ok:       boolean,
    error?:   string,
  ): Promise<void> {
    await (this.prisma as any).orgIntegration.updateMany({
      where: { organizationId: orgId, provider },
      data:  {
        lastTestedAt:  new Date(),
        lastTestOk:    ok,
        lastTestError: ok ? null : (error ?? 'Unknown error'),
      },
    });
  }

  // ── Odczyt odszyfrowanej konfiguracji (wewnętrzne API) ───────
  async getDecryptedConfig<T extends AnyIntegrationConfig>(
    orgId:    string,
    provider: Provider,
  ): Promise<T | null> {
    const record = await this._findRecord(orgId, provider);
    if (!record?.configEncrypted) return null;
    return this.crypto.decryptJson<T>(record.configEncrypted);
  }

  // ── Znajdź org po domenie emaila (JIT provisioning) ─────────
  async findOrgIdByEmailDomain(emailDomain: string): Promise<string | null> {
    const records = await (this.prisma as any).orgIntegration.findMany({
      where:   { provider: 'AZURE_ENTRA', isEnabled: true },
      include: { organization: { select: { id: true, isActive: true } } },
    });

    for (const record of records) {
      if (!record.organization?.isActive) continue;
      const cfg = this.crypto.decryptJson<AzureEntraConfig>(record.configEncrypted);
      const allowed: string[] = cfg?.allowedDomains ?? [];
      // Brak ograniczeń domenowych LUB domena na liście
      if (allowed.length === 0 || allowed.includes(emailDomain)) {
        return record.organization.id;
      }
    }

    return null;
  }

  // ── Backward compat: pobierz Azure config (OrgIntegration lub Organization) ─
  async getAzureConfig(orgId: string): Promise<{ tenantId: string; isEnabled: boolean; clientId?: string; clientSecret?: string } | null> {
    // Próba 1: nowy model OrgIntegration
    const record = await this._findRecord(orgId, 'AZURE_ENTRA');
    if (record) {
      const cfg = this.crypto.decryptJson<AzureEntraConfig>(record.configEncrypted);
      return {
        tenantId:     cfg?.tenantId ?? record.tenantHint ?? '',
        isEnabled:    record.isEnabled,
        clientId:     cfg?.clientId,
        clientSecret: cfg?.clientSecret,
      };
    }

    // Fallback: stare pola Organization.azureTenantId (backward compat)
    const org = await this.prisma.organization.findUnique({
      where:  { id: orgId },
      select: { azureTenantId: true, azureEnabled: true },
    });
    if (!org?.azureTenantId) return null;
    return { tenantId: org.azureTenantId, isEnabled: org.azureEnabled ?? false };
  }

  // ── Internal helpers ─────────────────────────────────────────
  private async _findRecord(orgId: string, provider: Provider) {
    return (this.prisma as any).orgIntegration.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider } },
    });
  }

  private _toPublicView(r: any): IntegrationPublicView {
    // Dekoduj konfigurację żeby wyciągnąć publiczne pola (bez sekretów)
    let publicConfig: Record<string, unknown> | undefined;

    if (r.configEncrypted) {
      const cfg = this.crypto.decryptJson<any>(r.configEncrypted);
      if (cfg) {
        publicConfig = this._scrubSecrets(r.provider, cfg);
      }
    }

    return {
      id:             r.id,
      organizationId: r.organizationId,
      provider:       r.provider,
      isEnabled:      r.isEnabled,
      displayName:    r.displayName ?? null,
      tenantHint:     r.tenantHint ?? null,
      hasConfig:      !!r.configEncrypted,
      lastTestedAt:   r.lastTestedAt?.toISOString() ?? null,
      lastTestOk:     r.lastTestOk ?? null,
      lastTestError:  r.lastTestError ?? null,
      publicConfig,
    };
  }

  /** Usuwa pola zawierające sekrety przed wysłaniem do frontendu */
  private _scrubSecrets(provider: Provider, cfg: any): Record<string, unknown> {
    switch (provider) {
      case 'AZURE_ENTRA':
        return {
          tenantId:       cfg.tenantId,
          useCustomApp:   cfg.useCustomApp,
          hasClientSecret: !!cfg.clientSecret,
          allowedDomains: cfg.allowedDomains ?? [],
          groupSync:      cfg.groupSync ?? false,
        };
      case 'SLACK':
        return {
          defaultChannel:       cfg.defaultChannel,
          notifyOnReservation:  cfg.notifyOnReservation,
          notifyOnCheckin:      cfg.notifyOnCheckin,
          notifyOnBeaconAlert:  cfg.notifyOnBeaconAlert,
          notifyOnGatewayAlert: cfg.notifyOnGatewayAlert,
          hasToken:             !!cfg.botToken,
        };
      case 'GOOGLE_WORKSPACE':
        return {
          allowedDomain:   cfg.allowedDomain,
          hasClientSecret: !!cfg.clientSecret,
        };
      case 'MICROSOFT_TEAMS':
        return {
          notifyOnReservation:  cfg.notifyOnReservation,
          notifyOnCheckin:      cfg.notifyOnCheckin,
          notifyOnBeaconAlert:  cfg.notifyOnBeaconAlert,
          hasWebhookUrl:        !!cfg.incomingWebhookUrl,
        };
      case 'WEBHOOK_CUSTOM':
        return {
          url:           cfg.url,
          events:        cfg.events ?? [],
          hasSecret:     !!cfg.secret,
          timeoutMs:     cfg.timeoutMs ?? 5000,
          maxRetries:    cfg.maxRetries ?? 3,
        };
      default:
        return {};
    }
  }
}
