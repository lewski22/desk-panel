/**
 * OwnerService — panel zarządzania dla roli OWNER (SaaS operator).
 *
 * OWNER to rola ponadorganizacyjna zarządzająca całą platformą Reserti.
 * Serwis umożliwia:
 * - Podgląd listy organizacji z metrykami (użytkownicy, biurka, lokalizacje)
 * - Tworzenie i edycję organizacji oraz ich planów subskrypcji
 * - Impersonację — generowanie jednorazowego tokenu JWT pozwalającego
 *   zalogować się jako SUPER_ADMIN wybranej organizacji (link wysyłany emailem)
 * - Podgląd globalnych eventów systemu (logi audytowe)
 * - Powiadomienia o zbliżającym się wygaśnięciu planów
 *
 * backend/src/modules/owner/owner.service.ts
 */
import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt       from 'bcrypt';
import { randomBytes }   from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, EventType } from '@prisma/client';
import { CreateOrgDto }  from './dto/create-org.dto';
import { UpdateOrgDto }  from './dto/update-org.dto';

@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  // ── Lista firm z metrykami ────────────────────────────────────
  async getOrganizations(filter: {
    isActive?: boolean;
    plan?: string;
    search?: string;
  }) {
    const orgs = await this.prisma.organization.findMany({
      where: {
        ...(filter.isActive !== undefined && { isActive: filter.isActive }),
        ...(filter.plan && { plan: filter.plan }),
        ...(filter.search && {
          OR: [
            { name:         { contains: filter.search, mode: 'insensitive' } },
            { slug:         { contains: filter.search, mode: 'insensitive' } },
            { contactEmail: { contains: filter.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        locations: {
          include: {
            gateways: { select: { id: true, isOnline: true, lastSeen: true } },
            desks:    { include: { device: { select: { id: true, isOnline: true } } } },
          },
        },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgs.map(org => this._toSummary(org));
  }

  // ── Szczegóły firmy ───────────────────────────────────────────
  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        locations: {
          include: {
            gateways: true,
            desks:    { include: { device: true } },
          },
        },
        users:  { where: { deletedAt: null }, select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true } },
        events: { orderBy: { ts: 'desc' }, take: 20 },
        _count: { select: { users: true } },
      },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  // ── Utwórz firmę + SUPER_ADMIN ────────────────────────────────
  async createOrganization(dto: CreateOrgDto, ownerId: string) {
    const exists = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug "${dto.slug}" już istnieje`);

    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (emailExists) throw new ConflictException(`Email "${dto.adminEmail}" już istnieje`);

    const password     = this._generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const trialEndsAt = dto.trialDays
      ? new Date(Date.now() + dto.trialDays * 86_400_000)
      : null;

    const [firstName, ...rest] = dto.adminName.trim().split(' ');
    const lastName = rest.join(' ') || '';

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name:         dto.name,
          slug:         dto.slug,
          plan:         dto.plan ?? 'starter',
          contactEmail: dto.contactEmail,
          notes:        dto.notes,
          trialEndsAt,
          createdBy:    ownerId,
          isActive:     true,
        },
      });

      const user = await tx.user.create({
        data: {
          email:          dto.adminEmail.toLowerCase(),
          passwordHash,
          firstName:      firstName || dto.adminName,
          lastName,
          role:           UserRole.SUPER_ADMIN,
          organizationId: org.id,
          isActive:       true,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });

      return { org, user };
    });

    this.logger.log(`Created org "${org.name}" with admin ${user.email} by owner ${ownerId}`);

    return { org, user, temporaryPassword: password };
  }

  // ── Aktualizuj firmę ─────────────────────────────────────────
  async updateOrganization(id: string, dto: UpdateOrgDto) {
    await this.prisma.organization.findUniqueOrThrow({ where: { id } });
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.plan           !== undefined && { plan:           dto.plan }),
        ...(dto.isActive       !== undefined && { isActive:       dto.isActive }),
        ...(dto.notes          !== undefined && { notes:          dto.notes }),
        ...(dto.contactEmail   !== undefined && { contactEmail:   dto.contactEmail }),
        ...(dto.enabledModules !== undefined && { enabledModules: dto.enabledModules }),
        ...(dto.planExpiresAt  && { planExpiresAt: new Date(dto.planExpiresAt) }),
        ...(dto.trialEndsAt    && { trialEndsAt:   new Date(dto.trialEndsAt) }),
      },
    });
  }

  // ── Dezaktywuj firmę (soft delete) ────────────────────────────
  async deactivateOrganization(id: string) {
    return this.prisma.organization.update({
      where: { id },
      data:  { isActive: false },
    });
  }

  // ── Impersonation — JWT 30 min jako SUPER_ADMIN ───────────────
  async impersonate(orgId: string, ownerId: string, ip: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const admin = await this.prisma.user.findFirst({
      where: { organizationId: orgId, role: UserRole.SUPER_ADMIN, isActive: true },
    });

    if (!admin) {
      throw new NotFoundException('Brak aktywnego SUPER_ADMIN w tej organizacji');
    }

    // Audit trail
    await this.prisma.event.create({
      data: {
        type:    EventType.OWNER_IMPERSONATION,
        payload: { ownerId, orgId, orgName: org.name, ip, at: new Date().toISOString() },
      },
    });

    const token = this.jwt.sign(
      { sub: admin.id, email: admin.email, role: 'SUPER_ADMIN', orgId, impersonated: true },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '30m' },
    );

    const adminUrl = `${this.config.get('ADMIN_URL') ?? 'https://admin.prohalw2026.ovh'}/auth/impersonate?token=${token}`;

    this.logger.log(`Owner ${ownerId} impersonating org ${orgId} (${org.name}) from ${ip}`);

    return {
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      adminUrl,
      orgName: org.name,
    };
  }

  // ── Metryki platformy ─────────────────────────────────────────
  async getStats() {
    const now   = new Date();
    const today = new Date(now.toDateString());
    const week  = new Date(now.getTime() - 7 * 86_400_000);

    const [
      orgsTotal, orgsActive, orgsInactive, gatewaysAll, beaconsAll,
      checkinsToday, checkinsWeek,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { isActive: true } }),
      this.prisma.organization.count({ where: { isActive: false } }),
      this.prisma.gateway.findMany({ select: { id: true, isOnline: true, locationId: true } }),
      this.prisma.device.findMany({  select: { id: true, isOnline: true } }),
      this.prisma.checkin.count({ where: { checkedInAt: { gte: today } } }),
      this.prisma.checkin.count({ where: { checkedInAt: { gte: week } } }),
    ]);

    const gatewaysOnline = gatewaysAll.filter(g => g.isOnline).length;
    const beaconsOnline  = beaconsAll.filter(d => d.isOnline).length;

    // Firmy bez aktywności > 7 dni
    const inactiveOrgs = await this.prisma.organization.findMany({
      where: {
        isActive: true,
        events:   { none: { ts: { gte: week } } },
      },
      select: { id: true, name: true, slug: true, plan: true, createdAt: true },
      take: 10,
    });

    return {
      orgsTotal,
      orgsActive,
      orgsInactive,
      gatewaysTotal:  gatewaysAll.length,
      gatewaysOnline,
      beaconsTotal:   beaconsAll.length,
      beaconsOnline,
      checkinsToday,
      checkinsWeek,
      inactiveOrgs,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────
  private _generatePassword(): string {
    // 12-znakowe hasło: litery + cyfry
    return randomBytes(9).toString('base64').replace(/[+/=]/g, 'X');
  }

  private _toSummary(org: any) {
    const gateways = org.locations.flatMap((l: any) => l.gateways);
    const beacons  = org.locations.flatMap((l: any) =>
      l.desks.flatMap((d: any) => d.device ? [d.device] : [])
    );

    return {
      id:             org.id,
      name:           org.name,
      slug:           org.slug,
      plan:           org.plan ?? 'starter',
      isActive:       org.isActive,
      enabledModules: org.enabledModules ?? [],
      contactEmail: org.contactEmail,
      trialEndsAt:  org.trialEndsAt,
      planExpiresAt:org.planExpiresAt,
      notes:        org.notes,
      createdAt:    org.createdAt,
      usersCount:   org._count.users,
      locationsCount: org.locations.length,
      gateways: {
        total:  gateways.length,
        online: gateways.filter((g: any) => g.isOnline).length,
      },
      beacons: {
        total:  beacons.length,
        online: beacons.filter((d: any) => d.isOnline).length,
      },
    };
  }
}
