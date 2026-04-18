/**
 * AzureProvider — Sprint F1
 *
 * Weryfikacja konfiguracji Azure Entra ID.
 * Obsługuje BYOA (Bring Your Own App) dla Enterprise.
 *
 * backend/src/modules/integrations/providers/azure.provider.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { IntegrationsService } from '../integrations.service';
import type { AzureEntraConfig } from '../types/integration-config.types';

@Injectable()
export class AzureProvider {
  private readonly logger = new Logger(AzureProvider.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly config:       ConfigService,
  ) {}

  /**
   * test — weryfikuje czy Azure Tenant ID jest poprawny i dostępny.
   * Nie weryfikuje Client Secret BYOA (to by wymagało pełnego OAuth flow).
   * Sprawdza OIDC discovery endpoint — zawsze publiczny.
   */
  async test(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.integrations.getDecryptedConfig<AzureEntraConfig>(orgId, 'AZURE_ENTRA');

    // Fallback: stary model Organization
    const azureCfg = cfg ?? (await this._getFromOrg(orgId));
    if (!azureCfg?.tenantId) {
      return { ok: false, message: 'Brak Tenant ID — skonfiguruj integrację Azure' };
    }

    const tenantId = azureCfg.tenantId.trim();

    // Sprawdź format GUID
    const guidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRx.test(tenantId)) {
      return { ok: false, message: 'Tenant ID musi być w formacie GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' };
    }

    // Sprawdź dostępność OIDC discovery endpoint
    try {
      const url = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (resp.status === 400) {
        return { ok: false, message: 'Tenant ID nie istnieje lub jest nieprawidłowy w Entra ID' };
      }
      if (!resp.ok) {
        return { ok: false, message: `Azure odpowiedział: HTTP ${resp.status}` };
      }

      const data = await resp.json() as any;
      const issuer = data?.issuer ?? '';

      if (!issuer.includes(tenantId)) {
        return { ok: false, message: 'Tenant ID nie pasuje do odpowiedzi Azure' };
      }

      // Jeśli BYOA — sprawdź czy clientId jest podany
      if (cfg?.useCustomApp && !cfg?.clientId) {
        return { ok: false, message: 'BYOA: wymagany Client ID własnej aplikacji' };
      }

      return { ok: true, message: `Tenant ID poprawny${cfg?.useCustomApp ? ' (BYOA)' : ' (Reserti App)'}` };
    } catch (err: any) {
      this.logger.warn(`Azure test failed for org=${orgId}: ${err.message}`);
      return { ok: false, message: `Nie można połączyć z Azure: ${err.message}` };
    }
  }

  private async _getFromOrg(orgId: string): Promise<{ tenantId: string } | null> {
    return this.integrations.getAzureConfig(orgId);
  }
}
