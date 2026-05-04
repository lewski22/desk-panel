/**
 * OrganizationsService — zarządzanie organizacjami (multi-tenant).
 *
 * Dostępny wyłącznie dla roli SUPER_ADMIN i OWNER. Obsługuje CRUD
 * organizacji — jednostek tenancy systemu. Każda organizacja ma własne
 * lokalizacje, użytkowników, biurka i konfigurację integracji.
 *
 * backend/src/modules/organizations/organizations.service.ts
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    return this.prisma.organization.update({ where: { id }, data: dto });
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
}
