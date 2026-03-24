// ── locations.service.ts ─────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateLocationDto {
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  timezone?: string;
}

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId?: string) {
    return this.prisma.location.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        _count: { select: { desks: true, gateways: true } },
        organization: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const loc = await this.prisma.location.findUnique({
      where: { id },
      include: {
        desks:    { orderBy: [{ floor: 'asc' }, { code: 'asc' }] },
        gateways: true,
        organization: { select: { name: true, plan: true } },
      },
    });
    if (!loc) throw new NotFoundException(`Location ${id} not found`);
    return loc;
  }

  async create(dto: CreateLocationDto) {
    return this.prisma.location.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateLocationDto> & { isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async getOccupancyReport(id: string) {
    await this.findOne(id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDesks, reservationsToday, checkinsToday] = await Promise.all([
      this.prisma.desk.count({ where: { locationId: id, status: 'ACTIVE' } }),
      this.prisma.reservation.count({
        where: { desk: { locationId: id }, date: today, status: { in: ['CONFIRMED', 'PENDING'] } },
      }),
      this.prisma.checkin.count({
        where: { desk: { locationId: id }, checkedInAt: { gte: today }, checkedOutAt: null },
      }),
    ]);

    return {
      locationId: id,
      date:       today.toISOString().slice(0, 10),
      totalDesks,
      reservationsToday,
      currentlyOccupied: checkinsToday,
      occupancyPct: totalDesks ? Math.round((checkinsToday / totalDesks) * 100) : 0,
    };
  }
}
