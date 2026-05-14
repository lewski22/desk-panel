import {
  Injectable, ConflictException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService }           from '../../database/prisma.service';
import { UserRole }                from '@prisma/client';
import { UpdateKioskSettingsDto }  from './dto/kiosk-settings.dto';

const DEFAULT_SETTINGS = {
  floor:           null,
  displayMode:     'tiles',
  columns:         'auto',
  refreshInterval: 30,
};

@Injectable()
export class KioskService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────

  private generatePassword(): string {
    return crypto.randomBytes(15).toString('base64url');
  }

  private findKioskAccount(orgId: string) {
    return this.prisma.user.findFirst({
      where: { organizationId: orgId, role: UserRole.KIOSK },
    });
  }

  // ── Admin API ─────────────────────────────────────────────────

  async createAccount(orgId: string): Promise<{ email: string; plaintextPassword: string }> {
    const existing = await this.findKioskAccount(orgId);
    if (existing) throw new ConflictException('Konto kiosk dla tej organizacji już istnieje');

    const org = await this.prisma.organization.findUniqueOrThrow({
      where:  { id: orgId },
      select: {
        slug:      true,
        locations: { where: { isActive: true }, take: 1, select: { id: true } },
      },
    });

    const email    = `kiosk@${org.slug}.reserti.local`;
    const password = this.generatePassword();
    const hash     = await bcrypt.hash(password, 10);

    const firstLocationId = org.locations[0]?.id ?? null;
    const kioskSettings   = firstLocationId
      ? { ...DEFAULT_SETTINGS, locationId: firstLocationId }
      : null;

    await this.prisma.user.create({
      data: {
        email,
        passwordHash:   hash,
        firstName:      'Kiosk',
        lastName:       null,
        role:           UserRole.KIOSK,
        organizationId: orgId,
        isActive:       true,
        kioskSettings:  kioskSettings as any,
      },
    });

    return { email, plaintextPassword: password };
  }

  async getAccount(orgId: string) {
    const account = await this.findKioskAccount(orgId);
    if (!account) throw new NotFoundException('Brak konta kiosk dla tej organizacji');

    const { passwordHash: _pwd, ...safe } = account;
    return safe;
  }

  async resetPassword(orgId: string): Promise<{ plaintextPassword: string }> {
    const account = await this.findKioskAccount(orgId);
    if (!account) throw new NotFoundException('Brak konta kiosk dla tej organizacji');

    const password = this.generatePassword();
    const hash     = await bcrypt.hash(password, 10);

    await this.prisma.user.update({ where: { id: account.id }, data: { passwordHash: hash } });
    await this.prisma.refreshToken.deleteMany({ where: { userId: account.id } });

    return { plaintextPassword: password };
  }

  async toggleStatus(orgId: string, isActive: boolean): Promise<void> {
    const account = await this.findKioskAccount(orgId);
    if (!account) throw new NotFoundException('Brak konta kiosk dla tej organizacji');

    await this.prisma.user.update({ where: { id: account.id }, data: { isActive } });
    if (!isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: account.id } });
    }
  }

  // ── KIOSK self API ────────────────────────────────────────────

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: { kioskSettings: true },
    });
    return user.kioskSettings;
  }

  async updateSettings(
    userId: string,
    orgId:  string,
    dto:    UpdateKioskSettingsDto,
  ): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId: orgId },
    });
    if (!location) throw new ForbiddenException('Brak dostępu do tej lokalizacji');

    await this.prisma.user.update({
      where: { id: userId },
      data:  { kioskSettings: dto as any },
    });
  }
}
