/**
 * GoogleProvider — Sprint F3
 *
 * Weryfikacja konfiguracji Google Workspace SSO per organizacja.
 * Każda org dostarcza własny Client ID/Secret z Google Cloud Console.
 * Parametr hd= ogranicza logowanie do domeny firmy.
 *
 * backend/src/modules/integrations/providers/google.provider.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import type { GoogleWorkspaceConfig } from '../types/integration-config.types';

@Injectable()
export class GoogleProvider {
  private readonly logger = new Logger(GoogleProvider.name);
  private readonly GOOGLE_DISCOVERY = 'https://accounts.google.com/.well-known/openid-configuration';

  constructor(private readonly integrations: IntegrationsService) {}

  /**
   * test — weryfikuje Client ID i format domeny.
   * Sprawdza czy Client ID jest poprawny (format xxx.apps.googleusercontent.com).
   * Sprawdza dostępność Google OIDC discovery.
   */
  async test(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.integrations.getDecryptedConfig<GoogleWorkspaceConfig>(orgId, 'GOOGLE_WORKSPACE');

    if (!cfg?.clientId) {
      return { ok: false, message: 'Brak Client ID — skonfiguruj integrację Google Workspace' };
    }
    if (!cfg.clientSecret) {
      return { ok: false, message: 'Brak Client Secret' };
    }
    if (!cfg.allowedDomain) {
      return { ok: false, message: 'Brak domeny firmy (np. company.com)' };
    }

    // Walidacja formatu Client ID Google
    if (!cfg.clientId.endsWith('.apps.googleusercontent.com')) {
      return {
        ok: false,
        message: 'Client ID musi kończyć się na ".apps.googleusercontent.com"',
      };
    }

    // Walidacja formatu domeny
    const domainRx = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRx.test(cfg.allowedDomain)) {
      return { ok: false, message: `Nieprawidłowy format domeny: ${cfg.allowedDomain}` };
    }

    // Sprawdź dostępność Google OIDC
    try {
      const resp = await fetch(this.GOOGLE_DISCOVERY, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        return { ok: false, message: `Google OIDC niedostępny: HTTP ${resp.status}` };
      }
      const data = await resp.json() as any;
      if (!data?.authorization_endpoint) {
        return { ok: false, message: 'Nieprawidłowa odpowiedź Google OIDC discovery' };
      }

      return {
        ok: true,
        message: `Konfiguracja poprawna — domena: ${cfg.allowedDomain}. Client ID: ${cfg.clientId.slice(0, 20)}...`,
      };
    } catch (err: any) {
      return { ok: false, message: `Nie można połączyć z Google: ${err.message}` };
    }
  }

  /**
   * buildAuthUrl — generuje URL logowania Google z parametrem hd=.
   * Wywoływany przez AuthController przy inicjacji Google SSO.
   */
  buildAuthUrl(orgId: string, cfg: GoogleWorkspaceConfig, state: string): string {
    const params = new URLSearchParams({
      client_id:     cfg.clientId,
      redirect_uri:  `${process.env.PUBLIC_API_URL ?? ''}/auth/google/callback`,
      response_type: 'code',
      scope:         'openid email profile',
      hd:            cfg.allowedDomain, // ← kluczowy param, ogranicza do domeny firmy
      state,
      access_type:   'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * verifyIdToken — weryfikuje Google ID token i zwraca claims.
   * Używane po redirect callback.
   */
  async verifyIdToken(cfg: GoogleWorkspaceConfig, idToken: string): Promise<{
    sub: string; email: string; name: string; hd?: string;
  } | null> {
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!resp.ok) return null;

      const claims = await resp.json() as any;

      // Sprawdź domenę
      if (claims.hd !== cfg.allowedDomain) {
        this.logger.warn(`Google SSO domain mismatch: expected ${cfg.allowedDomain}, got ${claims.hd}`);
        return null;
      }
      // Sprawdź audience
      if (claims.aud !== cfg.clientId) {
        this.logger.warn(`Google SSO audience mismatch`);
        return null;
      }

      return {
        sub:   claims.sub,
        email: claims.email,
        name:  claims.name ?? '',
        hd:    claims.hd,
      };
    } catch {
      return null;
    }
  }
}
