/**
 * ResourcesService — Sprint E2
 * Sale konferencyjne, parking, equipment
 * CRUD zasobów + bookings z walidacją konfliktów
 */
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  // ── Lista zasobów per lokalizacja ─────────────────────────────
  async findAll(locationId: string, type?: string, date?: string) {
    const now = new Date();
    const todayWaw = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
    const isToday  = !date || date === todayWaw;

    let bookingWhere: any;
    if (isToday) {
      bookingWhere = {
        status:    'CONFIRMED',
        startTime: { lte: now },
        endTime:   { gt:  now },
      };
    } else {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd   = new Date(`${date}T23:59:59.999Z`);
      bookingWhere = {
        status:    'CONFIRMED',
        startTime: { gte: dayStart },
        endTime:   { lte: dayEnd  },
      };
    }

    const resources = await this.prisma.resource.findMany({
      where: {
        locationId,
        status: 'ACTIVE',
        ...(type && { type: type as any }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        bookings: {
          where:   bookingWhere,
          select:  { id: true, startTime: true, endTime: true, user: { select: { firstName: true, lastName: true } } },
          orderBy: { startTime: 'asc' },
          take:    1,
        },
      },
    });

    return resources.map(r => {
      const { bookings, ...rest } = r;
      return { ...rest, currentBooking: bookings[0] ?? null };
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.resource.findUnique({
      where:   { id },
      include: { location: { select: { name: true, organizationId: true } } },
    });
    if (!r) throw new NotFoundException('Resource not found');
    return r;
  }

  async create(locationId: string, dto: {
    type: string; name: string; code: string; description?: string;
    capacity?: number; amenities?: string[]; vehicleType?: string;
    floor?: string; zone?: string;
  }) {
    try {
      return await this.prisma.resource.create({
        data: { ...dto, locationId, type: dto.type as any },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2003') throw new BadRequestException('Lokalizacja nie istnieje');
        if (e.code === 'P2002') throw new ConflictException('Zasób o tym kodzie już istnieje');
      }
      throw e;
    }
  }

  async update(id: string, dto: Partial<{
    name: string; description: string; capacity: number; amenities: string[];
    vehicleType: string; floor: string; zone: string; status: string;
    posX: number; posY: number; rotation: number;
  }>) {
    return this.prisma.resource.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.resource.update({
      where: { id },
      data:  { status: 'INACTIVE' },
    });
  }

  // ── Dostępność zasobu na dany dzień ───────────────────────────
  async getAvailability(resourceId: string, date: string) {
    // Load resource together with location hours so slots respect office openTime/closeTime
    const resource = await this.prisma.resource.findUnique({
      where:   { id: resourceId },
      include: { location: { select: { name: true, organizationId: true, openTime: true, closeTime: true } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    // Wszystkie bookings na ten dzień (wall-clock UTC — 00:00–23:59 biurowego dnia)
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);

    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status:    'CONFIRMED',
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, startTime: true, endTime: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { startTime: 'asc' },
    });

    // Parse office hours from location (fallback: 08:00–20:00 for legacy locations without config)
    const [openH,  openM]  = ((resource.location as any)?.openTime  ?? '08:00').split(':').map(Number);
    const [closeH, closeM] = ((resource.location as any)?.closeTime ?? '20:00').split(':').map(Number);
    const openTotal  = openH  * 60 + openM;
    const closeTotal = closeH * 60 + closeM;

    // Generate 30-min slots bounded by office openTime–closeTime (not hardcoded 8–20)
    const slots: { time: string; available: boolean; bookingId?: string }[] = [];
    for (let totalMin = openTotal; totalMin + 30 <= closeTotal; totalMin += 30) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const slotStart = new Date(`${date}T${hh}:${mm}:00.000Z`);
      const slotEnd   = new Date(slotStart.getTime() + 30 * 60_000);
      const conflict  = bookings.find(b => b.startTime < slotEnd && b.endTime > slotStart);
      slots.push({ time: `${hh}:${mm}`, available: !conflict, bookingId: conflict?.id });
    }

    return { resource, date, bookings, slots };
  }

  // ── Utwórz booking z walidacją konfliktów ─────────────────────
  async createBooking(resourceId: string, userId: string, dto: {
    date: string; startTime: string; endTime: string; notes?: string;
  }) {
    const start = new Date(dto.startTime);
    const end   = new Date(dto.endTime);

    if (end <= start) throw new ConflictException('endTime musi być późniejszy niż startTime');

    // Sprawdź konflikty
    const conflict = await this.prisma.booking.findFirst({
      where: {
        resourceId,
        status:    'CONFIRMED',
        startTime: { lt: end },
        endTime:   { gt: start },
      },
    });
    if (conflict) throw new ConflictException('Zasób jest już zarezerwowany w tym czasie');

    return this.prisma.booking.create({
      data: {
        resourceId,
        userId,
        date:      new Date(dto.date),
        startTime: start,
        endTime:   end,
        notes:     dto.notes,
      },
      include: { resource: { select: { name: true, type: true } }, user: { select: { firstName: true, lastName: true } } },
    });
  }

  async cancelBooking(bookingId: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    // Własna rezerwacja lub Admin+
    if (booking.userId !== userId && !['SUPER_ADMIN','OFFICE_ADMIN'].includes(role)) {
      throw new ConflictException('Brak uprawnień do anulowania tej rezerwacji');
    }
    return this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
  }

  // ── My bookings ───────────────────────────────────────────────
  async myBookings(userId: string, fromDate?: string) {
    const from = fromDate ? new Date(fromDate) : new Date();
    return this.prisma.booking.findMany({
      where:   { userId, status: 'CONFIRMED', endTime: { gte: from } },
      include: { resource: { select: { id: true, name: true, type: true, location: { select: { name: true } } } } },
      orderBy: { startTime: 'asc' },
      take:    20,
    });
  }
}
