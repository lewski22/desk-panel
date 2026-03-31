import {
  Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { JwtService }     from '@nestjs/jwt';
import { ConfigService }  from '@nestjs/config';
import * as jwt           from 'jsonwebtoken';
import * as jwksRsa       from 'jwks-rsa';
import { PrismaService }  from '../../database/prisma.service';
import { UserRole }       from '@prisma/client';
import { AuthService }    from './auth.service';

// Pola wyciągane z Azure ID token
interface AzureClaims {
  oid: string;       // Azure object ID — stałe ID użytkownika w Entra ID
  tid: string;       // Tenant ID firmy
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
export class AzureAuthService {
  private readonly logger = new Logger(AzureAuthService.name);

  // Cache JWKS klientów per tenant (unikamy ponownego tworzenia)
  private jwksCache = new Map<string, jwksRsa.JwksClient>();

  constructor(
    private prisma:  PrismaService,
    private auth:    AuthService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  // ── Główny punkt wejścia — weryfikuje token i wydaje JWT Reserti ──
  async loginWithAzureToken(idToken: string) {
    // 1. Dekoduj nagłówek żeby poznać tenant (bez weryfikacji podpisu)
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new UnauthorizedException('Nieprawidłowy token Azure');
    }

    const claims = decoded.payload as AzureClaims;
    const tenantId = claims.tid;
    if (!tenantId) {
      throw new UnauthorizedException('Token nie zawiera tenant ID');
    }

    // 2. Zweryfikuj podpis używając JWKS Azure (klucze publiczne)
    await this._verifySignature(idToken, tenantId);

    // 3. Sprawdź czy firma ma azureEnabled
    const org = await this.prisma.organization.findFirst({
      where: { azureTenantId: tenantId, azureEnabled: true, isActive: true },
    });
    if (!org) {
      throw new UnauthorizedException(
        'Logowanie przez Microsoft nie jest skonfigurowane dla tej organizacji. ' +
        'Skontaktuj się z administratorem.',
      );
    }

    // 4. JIT provisioning — znajdź lub utwórz użytkownika
    const user = await this._getOrCreateUser(claims, org.id);

    // 5. Wydaj JWT Reserti (identyczny jak przy email/password)
    return this.auth.login(user);
  }

  // ── Weryfikacja podpisu tokenu przez JWKS Azure ───────────────
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
        algorithms:  ['RS256'],
        audience:    clientId,
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

  // ── JWKS klient z cache per tenant ────────────────────────────
  private _getJwksClient(tenantId: string): jwksRsa.JwksClient {
    if (this.jwksCache.has(tenantId)) {
      return this.jwksCache.get(tenantId)!;
    }
    const client = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache:   true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    this.jwksCache.set(tenantId, client);
    return client;
  }

  // ── JIT provisioning — znajdź lub utwórz użytkownika ─────────
  private async _getOrCreateUser(claims: AzureClaims, orgId: string) {
    const oid   = claims.oid;
    const email = claims.email ?? claims.preferred_username ?? '';
    const firstName = claims.given_name ?? claims.name?.split(' ')[0] ?? '';
    const lastName  = claims.family_name ?? claims.name?.split(' ').slice(1).join(' ') ?? '';

    if (!email) {
      throw new UnauthorizedException('Token Azure nie zawiera adresu email');
    }

    // Szukaj po azureObjectId (najpewniejsze) lub email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { azureObjectId: oid },
          { email: email.toLowerCase() },
        ],
      },
    });

    if (user) {
      // Aktualizuj azureObjectId jeśli loguje się po raz pierwszy przez Azure
      if (!user.azureObjectId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data:  { azureObjectId: oid, azureTenantId: claims.tid },
        });
      }
      if (!user.isActive) {
        throw new UnauthorizedException('Konto jest nieaktywne');
      }
      return user;
    }

    // JIT provisioning — utwórz konto
    this.logger.log(`JIT provisioning: ${email} (oid: ${oid}, org: ${orgId})`);
    user = await this.prisma.user.create({
      data: {
        email:          email.toLowerCase(),
        // Marker zamiast pustego stringu — validateUser blokuje login hasłem
        // dla kont stworzonych wyłącznie przez Azure SSO
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

    this.logger.log(`JIT user created: ${user.id} (${email})`);
    return user;
  }

  // ── Sprawdź czy dana organizacja ma SSO włączone ──────────────
  // Używane przez frontend żeby zdecydować czy pokazać przycisk Microsoft
  async checkSsoAvailable(orgSlug?: string, email?: string): Promise<{
    available: boolean;
    tenantId?: string;
  }> {
    if (!orgSlug && !email) return { available: false };

    let org: any = null;

    if (email) {
      // Szukaj po domenie email
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        // Znajdź użytkownika z tym emailem i sprawdź jego org
        const user = await this.prisma.user.findFirst({
          where: { email: email.toLowerCase() },
          include: { organization: { select: { azureEnabled: true, azureTenantId: true } } },
        });
        org = user?.organization;
      }
    }

    if (!org && orgSlug) {
      org = await this.prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { azureEnabled: true, azureTenantId: true },
      });
    }

    if (!org?.azureEnabled || !org?.azureTenantId) {
      return { available: false };
    }

    return { available: true, tenantId: org.azureTenantId };
  }

  // ── Pobierz konfigurację Azure dla org (dla panelu Admina) ────
  async getOrgAzureConfig(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where:  { id: orgId },
      select: { azureTenantId: true, azureEnabled: true },
    });
    return {
      azureTenantId: org?.azureTenantId ?? null,
      azureEnabled:  org?.azureEnabled ?? false,
    };
  }

  // ── Zaktualizuj konfigurację Azure dla org ────────────────────
  async updateOrgAzureConfig(orgId: string, dto: { azureTenantId?: string; azureEnabled?: boolean }) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.azureTenantId !== undefined && { azureTenantId: dto.azureTenantId || null }),
        ...(dto.azureEnabled  !== undefined && { azureEnabled:  dto.azureEnabled }),
      },
      select: { id: true, azureTenantId: true, azureEnabled: true },
    });
  }
}
