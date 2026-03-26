import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateLocationDto {
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  timezone?: string;
  openTime?: string;   // HH:mm, e.g. "08:00"
  closeTime?: string;  // HH:mm, e.g. "17:00"
}

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId?: string) {
    return this.prisma.location.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        _count:       { select: { desks: true, gateways: true } },
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
    // Single query — throws P2025 if not found, no pre-fetch needed
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async getOccupancyAnalytics(locationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // FIX: use parallel count queries instead of loading all desk rows
    const [total, occupied, todayCheckins, reservationsToday] = await Promise.all([
      this.prisma.desk.count({ where: { locationId, status: 'ACTIVE' } }),
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedOutAt: null },
      }),
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: today } },
      }),
      this.prisma.reservation.count({
        where: {
          desk:   { locationId },
          date:   today,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      }),
    ]);

    return {
      totalDesks:        total,
      occupiedDesks:     occupied,
      occupancyPct:      total > 0 ? Math.round((occupied / total) * 100) : 0,
      todayCheckins,
      reservationsToday,
    };
  }

  async getAnalyticsExtended(locationId: string) {
    const now    = new Date();
    const today  = new Date(now); today.setHours(0, 0, 0, 0);
    const days30 = new Date(today); days30.setDate(days30.getDate() - 30);
    const days7  = new Date(today); days7.setDate(days7.getDate() - 6);
    const lastWeekStart = new Date(today); lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const lastWeekEnd   = new Date(today); lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // FIX: one query for 30 days, all aggregations done in JS — avoids 7 round-trips
    const [recentCheckins, topDesks, methods, thisWeekCount, lastWeekCount] = await Promise.all([
      // All check-ins from last 30 days — used for hourly + weekly breakdown
      this.prisma.checkin.findMany({
        where: { desk: { locationId }, checkedInAt: { gte: days30 } },
        select: { checkedInAt: true },
      }),
      // Top 5 desks by check-in count
      this.prisma.desk.findMany({
        where:   { locationId, status: 'ACTIVE' },
        include: { _count: { select: { checkins: true, reservations: true } } },
        orderBy: { checkins: { _count: 'desc' } },
        take:    5,
      }),
      // Check-in method breakdown
      this.prisma.checkin.groupBy({
        by:    ['method'],
        where: { desk: { locationId }, checkedInAt: { gte: days30 } },
        _count: true,
      }),
      // This week count
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: lastWeekEnd, lt: now } },
      }),
      // Last week count
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      }),
    ]);

    // Build 7-day chart from in-memory data (no extra queries)
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const day  = new Date(days7); day.setDate(day.getDate() + i);
      const next = new Date(day);   next.setDate(next.getDate() + 1);
      return {
        day:      day.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' }),
        checkins: recentCheckins.filter(c => c.checkedInAt >= day && c.checkedInAt < next).length,
      };
    });

    // Hourly distribution from same dataset
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour:  `${String(h).padStart(2, '0')}:00`,
      count: recentCheckins.filter(c => c.checkedInAt.getHours() === h).length,
    }));

    const weekTrend = lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : 0;

    return { weekData, hourly, topDesks, weekTrend, thisWeekCount, lastWeekCount, methods };
  }
}
