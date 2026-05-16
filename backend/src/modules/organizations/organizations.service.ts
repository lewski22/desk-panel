/**
 * OrganizationsService — zarządzanie organizacjami (multi-tenant).
 *
 * Dostępny wyłącznie dla roli SUPER_ADMIN i OWNER. Obsługuje CRUD
 * organizacji — jednostek tenancy systemu. Każda organizacja ma własne
 * lokalizacje, użytkowników, biurka i konfigurację integracji.
 *
 * backend/src/modules/organizations/organizations.service.ts
 */
import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as path from 'path';
import * as fs   from 'fs/promises';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  plan?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  plan?: string;
  isActive?: boolean;
  passwordExpiryDays?:       number | null;
  passwordMinLength?:        number | null;
  passwordRequireUppercase?: boolean;
  passwordRequireNumbers?:   boolean;
  passwordRequireSpecial?:   boolean;
}

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      include: {
        _count: { select: { locations: true, users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        locations: {
          include: { _count: { select: { desks: true, gateways: true } } },
        },
        _count: { select: { users: true } },
      },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async create(dto: CreateOrganizationDto) {
    const exists = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug "${dto.slug}" already taken`);
    return this.prisma.organization.create({ data: dto });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined && { name:     dto.name }),
        ...(dto.plan     !== undefined && { plan:     dto.plan }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...('passwordExpiryDays'       in dto && { passwordExpiryDays:       dto.passwordExpiryDays ?? null }),
        ...('passwordMinLength'        in dto && { passwordMinLength:        dto.passwordMinLength ?? null }),
        ...('passwordRequireUppercase' in dto && { passwordRequireUppercase: dto.passwordRequireUppercase }),
        ...('passwordRequireNumbers'   in dto && { passwordRequireNumbers:   dto.passwordRequireNumbers }),
        ...('passwordRequireSpecial'   in dto && { passwordRequireSpecial:   dto.passwordRequireSpecial }),
      },
    });
  }

  async getCustomAmenities(orgId: string): Promise<string[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { customAmenities: true },
    });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org.customAmenities;
  }

  async updateCustomAmenities(orgId: string, amenities: string[]): Promise<string[]> {
    const cleaned = [...new Set(
      amenities.map(a => a.trim().toLowerCase()).filter(a => a.length > 0),
    )];
    if (cleaned.length > 50) {
      throw new BadRequestException('Maximum 50 custom amenities allowed');
    }
    const invalid = cleaned.find(a => a.length > 40);
    if (invalid) {
      throw new BadRequestException(`Amenity tag too long (max 40 chars): "${invalid}"`);
    }
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data:  { customAmenities: cleaned },
      select: { customAmenities: true },
    });
    return org.customAmenities;
  }

  async getStats(id: string) {
    await this.findOne(id);
    const [desks, reservations, checkins] = await Promise.all([
      this.prisma.desk.count({ where: { location: { organizationId: id } } }),
      this.prisma.reservation.count({
        where: { desk: { location: { organizationId: id } } },
      }),
      this.prisma.checkin.count({
        where: { desk: { location: { organizationId: id } } },
      }),
    ]);
    return { organizationId: id, totalDesks: desks, totalReservations: reservations, totalCheckins: checkins };
  }

  // ── Logo management ───────────────────────────────────────────────────────

  async uploadLogo(
    orgId: string,
    file: Express.Multer.File,
    bgColor?: string,
  ): Promise<{ logoUrl: string }> {
    await this.findOne(orgId);

    const uploadDir = path.resolve(process.cwd(), 'uploads', 'logos');
    await fs.mkdir(uploadDir, { recursive: true });

    // Delete previous logo file if exists
    const current = await this.prisma.organization.findUnique({
      where: { id: orgId }, select: { logoUrl: true },
    });
    if (current?.logoUrl) {
      const prevFile = path.join(uploadDir, path.basename(current.logoUrl));
      await fs.unlink(prevFile).catch(() => undefined);
    }

    const ext      = file.mimetype === 'image/svg+xml' ? '.svg' : path.extname(file.originalname) || '.png';
    const filename = `${orgId}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const dest     = path.join(uploadDir, filename);

    try {
      await fs.writeFile(dest, file.buffer);
    } catch {
      throw new InternalServerErrorException('Failed to save logo file');
    }

    const logoUrl = `/uploads/logos/${filename}`;

    await this.prisma.organization.update({
      where: { id: orgId },
      data:  {
        logoUrl,
        ...(bgColor !== undefined && { logoBgColor: bgColor || null }),
      },
    });

    return { logoUrl };
  }

  async deleteLogo(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId }, select: { logoUrl: true },
    });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    if (org.logoUrl) {
      const uploadDir = path.resolve(process.cwd(), 'uploads', 'logos');
      const filepath  = path.join(uploadDir, path.basename(org.logoUrl));
      await fs.unlink(filepath).catch(() => undefined);
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data:  { logoUrl: null, logoBgColor: null },
    });
  }

  // ── White-label flag — OWNER only ─────────────────────────────────────────

  async setWhitelabel(orgId: string, enabled: boolean): Promise<void> {
    await this.prisma.organization.update({
      where: { id: orgId },
      data:  { whitelabelEnabled: enabled },
    });
  }

  async forcePasswordReset(orgId: string): Promise<{ affected: number }> {
    await this.findOne(orgId);
    const result = await this.prisma.user.updateMany({
      where: {
        organizationId: orgId,
        isActive:       true,
        deletedAt:      null,
        passwordHash:   { notIn: ['AZURE_SSO_ONLY', 'GOOGLE_SSO_ONLY'] },
        role:           { in: ['END_USER', 'STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN'] },
      },
      data: { mustChangePassword: true },
    });
    return { affected: result.count };
  }
}
