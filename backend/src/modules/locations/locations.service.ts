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

  async getOccupancyAnalytics(locationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const desks = await this.prisma.desk.findMany({
      where: { locationId, status: 'ACTIVE' },
      include: {
        checkins: {
          where: { checkedOutAt: null },
          take: 1,
        },
      },
    });

    const total    = desks.length;
    const occupied = desks.filter(d => d.checkins.length > 0).length;

    const todayCheckins = await this.prisma.checkin.count({
      where: {
        desk:        { locationId },
        checkedInAt: { gte: today },
      },
    });

    const reservationsToday = await this.prisma.reservation.count({
      where: {
        desk:   { locationId },
        date:   today,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    return {
      totalDesks:       total,
      occupiedDesks:    occupied,
      occupancyPct:     total > 0 ? Math.round((occupied / total) * 100) : 0,
      todayCheckins,
      reservationsToday,
    };
  }
}
