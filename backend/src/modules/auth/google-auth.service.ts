/**
 * GoogleAuthService — Sprint F3
 *
 * Obsługuje Google OAuth2 redirect + callback.
 * Używa per-org Client ID/Secret z OrgIntegration.
 * JIT provisioning: user Google → User Reserti.
 *
 * backend/src/modules/auth/google-auth.service.ts
 */
import {
  Injectable, Logger, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { randomBytes }         from 'crypto';
import { PrismaService }       from '../../database/prisma.service';
import { AuthService }         from './auth.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { GoogleProvider }      from '../integrations/providers/google.provider';
import { NonceStoreService }   from './nonce-store.service';
import type { GoogleWorkspaceConfig } from '../integrations/types/integration-config.types';

const REDIRECT_URI_PATH = '/auth/google/callback';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly auth:          AuthService,
    private readonly config:        ConfigService,
    private readonly integrations:  IntegrationsService,
    private readonly googleProvider: GoogleProvider,
    private readonly nonceStore:    NonceStoreService,
  ) {}

  // ── Krok 1: zbuduj URL redirect do Google ───────────────────
  /**
   * buildRedirectUrl — znajdź konfigurację Google Workspace dla org
   * i zbuduj URL OAuth2 consent page.
   *
   * @param orgId       — ID organizacji (z JWT lub query slug)
   * @param redirectUrl — URL frontendu do przekierowania po sukcesie
   */
  async buildRedirectUrl(orgId: string, redirectUrl?: string): Promise<string> {
    const cfg = await this.integrations.getDecryptedConfig<GoogleWorkspaceConfig>(
      orgId, 'GOOGLE_WORKSPACE',
    );
    if (!cfg?.clientId || !cfg?.clientSecret) {
      throw new BadRequestException(
        'Integracja Google Workspace nie jest skonfigurowana dla tej organizacji',
      );
    }
    if (!cfg.allowedDomain) {
      throw new BadRequestException('Brak zdefiniowanej domeny Google Workspace');
    }

    // Generuj nonce — CSRF protection
    const nonce = randomBytes(16).toString('hex');
    await this.nonceStore.set(nonce, {
      orgId,
      redirectUrl: redirectUrl ?? this._frontendUrl(),
    });

    // Zakoduj nonce w state (base64 JSON)
    const state = Buffer.from(JSON.stringify({ nonce, orgId })).toString('base64url');

    return this.googleProvider.buildAuthUrl(orgId, cfg, state);
  }

  // ── Krok 2: obsłuż callback (code exchange) ─────────────────
  /**
   * handleCallback — Exchange authorization code → tokens → user → JWT Reserti.
   * Zwraca Reserti accessToken + redirectUrl do frontendu.
   */
  async handleCallback(code: string, state: string): Promise<{ accessToken: string; redirectUrl: string }> {
    // 1. Dekoduj i waliduj state
    let parsed: { nonce: string; orgId: string };
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Nieprawidłowy state parameter');
    }

    const entry = await this.nonceStore.get(parsed.nonce);
    if (!entry || entry.expiresAt < Date.now() || entry.orgId !== parsed.orgId) {
      throw new UnauthorizedException('State wygasł lub jest nieprawidłowy — zacznij logowanie od nowa');
    }
    await this.nonceStore.delete(parsed.nonce); // jednorazowe użycie

    const { orgId, redirectUrl } = entry;

    // 2. Pobierz konfigurację org
    const cfg = await this.integrations.getDecryptedConfig<GoogleWorkspaceConfig>(
      orgId, 'GOOGLE_WORKSPACE',
    );
    if (!cfg?.clientId || !cfg?.clientSecret) {
      throw new UnauthorizedException('Konfiguracja Google Workspace nieaktualna');
    }

    // 3. Wymień code na tokeny
    const tokens = await this._exchangeCode(code, cfg);
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google nie zwróciło ID token');
    }

    // 4. Zweryfikuj ID token (domena + audience)
    const claims = await this.googleProvider.verifyIdToken(cfg, tokens.id_token);
    if (!claims) {
      throw new UnauthorizedException(
        `Logowanie przez Google dozwolone tylko dla domeny @${cfg.allowedDomain}`,
      );
    }

    // 5. JIT provisioning
    const user = await this._getOrCreateUser(claims, orgId);

    // 6. Wydaj Reserti JWT
    const { accessToken } = await this.auth.login(user);

    this.logger.log(`Google SSO login: ${claims.email} → org=${orgId} user=${user.id}`);

    return {
      accessToken,
      redirectUrl: redirectUrl ?? this._frontendUrl(),
    };
  }

  // ── checkAvailable — czy Google SSO jest skonfigurowane? ────
  async checkAvailable(email?: string, orgSlug?: string): Promise<{ available: boolean; domain?: string }> {
    // Szukaj po domenie emaila
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        const user = await this.prisma.user.findFirst({
          where:  { email: email.toLowerCase() },
          select: { organizationId: true },
        });
        if (user?.organizationId) {
          const cfg = await this.integrations.getDecryptedConfig<GoogleWorkspaceConfig>(
            user.organizationId, 'GOOGLE_WORKSPACE',
          );
          const integration = await this.integrations.findOne(user.organizationId, 'GOOGLE_WORKSPACE');
          if (cfg?.allowedDomain && integration?.isEnabled) {
            return { available: true, domain: cfg.allowedDomain };
          }
        }
      }
    }
    return { available: false };
  }

  // ── Private: wymień code na tokeny ─────────────────────────
  private async _exchangeCode(code: string, cfg: GoogleWorkspaceConfig): Promise<{
    access_token: string; id_token?: string; refresh_token?: string; expires_in: number;
  }> {
    const redirectUri = `${this.config.get('PUBLIC_API_URL')}${REDIRECT_URI_PATH}`;

    const body = new URLSearchParams({
      code,
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as any;
      throw new UnauthorizedException(`Google token exchange failed: ${err.error_description ?? err.error ?? resp.status}`);
    }

    return resp.json() as any;
  }

  // ── Private: JIT provisioning ───────────────────────────────
  private async _getOrCreateUser(
    claims: { sub: string; email: string; name: string; hd?: string },
    orgId:  string,
  ) {
    const nameParts = claims.name.split(' ');
    const user = await this.auth.provisionSsoUser({
      email:          claims.email,
      orgId,
      firstName:      nameParts[0],
      lastName:       nameParts.slice(1).join(' ') || undefined,
      passwordMarker: 'GOOGLE_SSO_ONLY',
    });
    this.logger.log(`Google SSO user: ${user.id} (${claims.email}) → org=${orgId}`);
    return user;
  }

  private _frontendUrl(): string {
    return this.config.get('FRONTEND_URL') ?? '';
  }

}
