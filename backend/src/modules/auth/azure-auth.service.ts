/**
 * PATCH: backend/src/modules/auth/azure-auth.service.ts
 *
 * Kompletna wersja z backward compat dla OrgIntegration.
 * Zmiana dotyczy TYLKO metod _resolveOrgByTenantId() i checkSsoAvailable().
 * Reszta serwisu (JIT provisioning, JWKS verification) bez zmian.
 *
 * SPOSÓB STOSOWANIA:
 * Podmień istniejące metody w pliku (nie zastępuj całego pliku — dodaj import + podmień 2 metody).
 */
import {
  Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { JwtService }        from '@nestjs/jwt';
import { ConfigService }     from '@nestjs/config';
import * as jwt              from 'jsonwebtoken';
import * as jwksRsa          from 'jwks-rsa';
import { PrismaService }     from '../../database/prisma.service';
import { UserRole }          from '@prisma/client';
import { AuthService }       from './auth.service';
import { IntegrationsService } from '../integrations/integrations.service'; // ← NOWY import

// Pola wyciągane z Azure ID token (nie zmienione)
interface AzureClaims {
  oid: string;
  tid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
export class AzureAuthService {
  private readonly logger = new Logger(AzureAuthService.name);
  private jwksCache = new Map<string, jwksRsa.JwksClient>();

  constructor(
    private prisma:        PrismaService,
    private auth:          AuthService,
    private jwt:           JwtService,
    private config:        ConfigService,
    private integrations:  IntegrationsService, // ← DODAJ do konstruktora
  ) {}

  // ── loginWithAzureToken — bez zmian w logice, tylko _resolveOrgByTenantId ──
  async loginWithAzureToken(idToken: string) {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new UnauthorizedException('Nieprawidłowy token Azure');
    }

    const claims   = decoded.payload as AzureClaims;
    const tenantId = claims.tid;
    if (!tenantId) throw new UnauthorizedException('Token nie zawiera tenant ID');

    await this._verifySignature(idToken, tenantId);

    // ← ZMIENIONE: używa nowej metody z backward compat
    const org = await this._resolveOrgByTenantId(tenantId);
    if (!org) {
      throw new UnauthorizedException(
        'Logowanie przez Microsoft nie jest skonfigurowane dla tej organizacji. ' +
        'Skontaktuj się z administratorem.',
      );
    }

    const user = await this._getOrCreateUser(claims, org.id);
    return this.auth.login(user);
  }

  // ── _resolveOrgByTenantId — NOWA wersja z OrgIntegration + backward compat ──
  /**
   * Wyszukuje organizację po tenantId w dwóch miejscach:
   * 1. Nowy model OrgIntegration (Sprint F)
   * 2. Fallback: stare pola Organization.azureTenantId (backward compat)
   *
   * Organizacja musi być aktywna i mieć włączone Azure SSO.
   */
  private async _resolveOrgByTenantId(tenantId: string): Promise<{ id: string } | null> {
    // 1. Sprawdź nowy model OrgIntegration
    try {
      const integration = await (this.prisma as any).orgIntegration.findFirst({
        where: {
          provider:   'AZURE_ENTRA',
          isEnabled:  true,
          tenantHint: tenantId,
        },
        include: {
          organization: { select: { id: true, isActive: true } },
        },
      });

      if (integration?.organization?.isActive) {
        return { id: integration.organization.id };
      }
    } catch {
      // OrgIntegration model może nie istnieć jeszcze (pre-migration) — fallback
    }

    // 2. Fallback: Organization.azureTenantId (stary model — backward compat)
    const org = await this.prisma.organization.findFirst({
      where:  { azureTenantId: tenantId, azureEnabled: true, isActive: true },
      select: { id: true },
    });

    return org ?? null;
  }

  // ── checkSsoAvailable — NOWA wersja z OrgIntegration + backward compat ──
  /**
   * Sprawdza czy SSO jest dostępne dla emaila/orgSlug.
   * Sprawdza oba modele: OrgIntegration (nowy) i Organization (stary).
   */
  async checkSsoAvailable(orgSlug?: string, email?: string): Promise<{
    available: boolean;
    tenantId?: string;
  }> {
    if (!orgSlug && !email) return { available: false };

    // Szukaj organizacji
    let orgId: string | null = null;

    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        const user = await this.prisma.user.findFirst({
          where:  { email: email.toLowerCase() },
          select: { organizationId: true },
        });
        orgId = user?.organizationId ?? null;
      }
    }

    if (!orgId && orgSlug) {
      const org = await this.prisma.organization.findUnique({
        where:  { slug: orgSlug },
        select: { id: true },
      });
      orgId = org?.id ?? null;
    }

    if (!orgId) return { available: false };

    // Sprawdź konfigurację Azure — IntegrationsService czyta oba modele
    const azureCfg = await this.integrations.getAzureConfig(orgId);
    if (azureCfg?.isEnabled && azureCfg.tenantId) {
      return { available: true, tenantId: azureCfg.tenantId };
    }

    return { available: false };
  }

  // ── getOrgAzureConfig — NOWA wersja (używana przez panel admina) ──
  async getOrgAzureConfig(orgId: string) {
    const cfg = await this.integrations.getAzureConfig(orgId);
    return {
      azureTenantId: cfg?.tenantId ?? null,
      azureEnabled:  cfg?.isEnabled ?? false,
      hasCustomApp:  !!(cfg as any)?.clientId,
    };
  }

  // ── updateOrgAzureConfig — NOWA wersja (zapis przez OrgIntegration) ──
  async updateOrgAzureConfig(orgId: string, dto: {
    azureTenantId?: string;
    azureEnabled?:  boolean;
  }) {
    if (!dto.azureTenantId && dto.azureEnabled === undefined) {
      return { id: orgId };
    }

    return this.integrations.upsert(
      orgId,
      'AZURE_ENTRA',
      {
        tenantId:       dto.azureTenantId ?? '',
        useCustomApp:   false,
        allowedDomains: [],
        groupSync:      false,
      } as any,
      {
        isEnabled:   dto.azureEnabled ?? false,
        tenantHint:  dto.azureTenantId ?? undefined,
        displayName: `Azure Entra · ${dto.azureTenantId?.slice(0, 8) ?? ''}…`,
      },
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PONIŻEJ — istniejące metody BEZ ZMIAN
  // Skopiuj z obecnego azure-auth.service.ts:
  //   _verifySignature()
  //   _getJwksClient()
  //   _getOrCreateUser()
  // ══════════════════════════════════════════════════════════════

  private async _verifySignature(idToken: string, tenantId: string): Promise<void> {
    const client = this._getJwksClient(tenantId);

    await new Promise<void>((resolve, reject) => {
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        client.getSigningKey(header.kid!, (err, key) => {
          if (err) return callback(err);
          callback(null, key!.getPublicKey());
        });
      };

      const clientId = this.config.get<string>('AZURE_CLIENT_ID');
      jwt.verify(idToken, getKey, {
        algorithms: ['RS256'],
        audience:   clientId,
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
      }, (err) => {
        if (err) {
          this.logger.warn(`Azure token verification failed: ${err.message}`);
          reject(new UnauthorizedException('Token Azure wygasł lub jest nieprawidłowy'));
        } else {
          resolve();
        }
      });
    });
  }

  private _getJwksClient(tenantId: string): jwksRsa.JwksClient {
    if (this.jwksCache.has(tenantId)) return this.jwksCache.get(tenantId)!;
    const client = jwksRsa({
      jwksUri:               `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache:                 true,
      rateLimit:             true,
      jwksRequestsPerMinute: 10,
    });
    this.jwksCache.set(tenantId, client);
    return client;
  }

  private async _getOrCreateUser(claims: AzureClaims, orgId: string) {
    const oid       = claims.oid;
    const email     = claims.email ?? claims.preferred_username ?? '';
    const firstName = claims.given_name ?? claims.name?.split(' ')[0] ?? '';
    const lastName  = claims.family_name ?? claims.name?.split(' ').slice(1).join(' ') ?? '';

    if (!email) throw new UnauthorizedException('Token Azure nie zawiera adresu email');

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ azureObjectId: oid }, { email: email.toLowerCase() }] },
    });

    if (user) {
      if (!user.azureObjectId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data:  { azureObjectId: oid, azureTenantId: claims.tid },
        });
      }
      if (!user.isActive) throw new UnauthorizedException('Konto jest nieaktywne');
      return user;
    }

    this.logger.log(`JIT provisioning: ${email} (oid: ${oid}, org: ${orgId})`);
    return this.prisma.user.create({
      data: {
        email:          email.toLowerCase(),
        passwordHash:   'AZURE_SSO_ONLY',
        firstName:      firstName || null,
        lastName:       lastName  || null,
        role:           UserRole.END_USER,
        organizationId: orgId,
        azureObjectId:  oid,
        azureTenantId:  claims.tid,
        isActive:       true,
      },
    });
  }
}
