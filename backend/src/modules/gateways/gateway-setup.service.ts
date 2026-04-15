import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes }   from 'crypto';
import * as bcrypt       from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

const TOKEN_TTL_HOURS = 24;

@Injectable()
export class GatewaySetupService {
  constructor(private prisma: PrismaService) {}

  // ── Admin tworzy token instalacyjny ──────────────────────────
  async createToken(locationId: string, createdBy: string, actorOrgId?: string) {
    // Org guard — sprawdź czy lokalizacja należy do org aktora
    if (actorOrgId) {
      const loc = await this.prisma.location.findUnique({
        where: { id: locationId },
        select: { organizationId: true },
      });
      if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
      if (loc.organizationId !== actorOrgId) {
        throw new ForbiddenException('Lokalizacja nie należy do Twojej organizacji');
      }
    }
    // Sprawdź czy lokalizacja istnieje
    const loc = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { id: true, name: true, organization: { select: { name: true } } },
    });
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);

    // Jeden aktywny token per lokalizacja — unieważnij stare
    await this.prisma.gatewaySetupToken.updateMany({
      where: { locationId, usedAt: null },
      data:  { expiresAt: new Date() }, // wygaś natychmiast
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_TTL_HOURS);

    const record = await this.prisma.gatewaySetupToken.create({
      data: { locationId, createdBy, expiresAt },
    });

    return {
      token:     record.token,
      expiresAt: record.expiresAt,
      location:  loc,
      installCmd: this._buildCmd(record.token),
    };
  }

  // ── Skrypt instalacyjny pobiera konfigurację ─────────────────
  // Endpoint publiczny — nie wymaga JWT, ale token jest jednorazowy
  async redeemToken(token: string, gatewayName: string) {
    const record = await this.prisma.gatewaySetupToken.findUnique({
      where:   { token },
      include: {
        location: {
          select: {
            id: true, name: true, openTime: true, closeTime: true,
            organization: { select: { name: true } },
          },
        },
      },
    });

    if (!record)              throw new NotFoundException('Token nieprawidłowy');
    if (record.usedAt)        throw new ConflictException('Token już został użyty');
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Token wygasł — wygeneruj nowy w panelu Admin');
    }

    // Utwórz gateway automatycznie
    const secret     = randomBytes(24).toString('hex');
    const secretHash = await bcrypt.hash(secret, 10);
    const mqttPass   = randomBytes(20).toString('hex');

    const gateway = await this.prisma.gateway.create({
      data: {
        locationId: record.locationId,
        name:       gatewayName || `Gateway — ${record.location.name}`,
        secretHash,
      },
    });

    // Oznacz token jako użyty
    await this.prisma.gatewaySetupToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date(), gatewayId: gateway.id },
    });

    // Zwróć kompletną konfigurację do skryptu instalacyjnego
    return {
      gatewayId:     gateway.id,
      gatewaySecret: secret,
      locationId:    record.locationId,
      locationName:  record.location.name,
      serverUrl:     process.env.PUBLIC_API_URL
                     ?? `https://api.prohalw2026.ovh/api/v1`,
      mqttUsername:  'gateway',
      mqttPassword:  mqttPass,
      provisionKey:  process.env.GATEWAY_PROVISION_KEY ?? '',
    };
  }

  // ── Lista aktywnych tokenów dla lokalizacji ──────────────────
  async listTokens(locationId: string) {
    return this.prisma.gatewaySetupToken.findMany({
      where:   { locationId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select: {
        id: true, token: true, expiresAt: true,
        usedAt: true, createdAt: true,
        gateway: { select: { id: true, name: true } },
      },
    });
  }

  // ── Unieważnij token ─────────────────────────────────────────
  async revokeToken(tokenId: string) {
    await this.prisma.gatewaySetupToken.update({
      where: { id: tokenId },
      data:  { expiresAt: new Date() },
    });
    return { revoked: true };
  }

  private _buildCmd(token: string): string {
    const baseUrl = process.env.PUBLIC_API_URL
                    ?? 'https://api.prohalw2026.ovh/api/v1';
    const scriptUrl = baseUrl.replace('/api/v1', '/install/gateway');
    return `curl -fsSL ${scriptUrl}/${token} | bash`;
  }
}
