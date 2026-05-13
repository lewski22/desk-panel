/**
 * ResourcesService — Sprint E2 + ROOM-FIX (0.17.7)
 * Sale konferencyjne, parking, equipment
 * CRUD zasobów + bookings z walidacją konfliktów
 */
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService }        from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(
    private prisma:                PrismaService,
    private notificationsService:  NotificationsService,
  ) {}

  // ── Cross-tenant guard ────────────────────────────────────────
  private async assertResourceInOrg(resourceId: string, actorOrgId: string): Promise<void> {
    const r = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: { location: { select: { organizationId: true } } },
    });
    if (!r) throw new NotFoundException('Resource not found');
    if (r.location.organizationId !== actorOrgId) throw new ForbiddenException('Access denied');
  }

  private static readonly ALLOWED_TYPES = ['ROOM', 'PARKING', 'EQUIPMENT'];

  // ── Lista zasobów per lokalizacja ─────────────────────────────
  async findAll(locationId: string, type?: string, date?: string, actorOrgId?: string) {
    if (type && !ResourcesService.ALLOWED_TYPES.includes(type)) {
      throw new BadRequestException('Invalid resource type');
    }
    const now = new Date();

    // Pobierz timezone lokalizacji przed głównym zapytaniem
    const loc = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { timezone: true },
    });
    const tz = loc?.timezone ?? 'Europe/Warsaw';

    const todayLocal = now.toLocaleDateString('sv-SE', { timeZone: tz });
    const isToday    = !date || date === todayLocal;

    let bookingWhere: any;
    if (isToday) {
      bookingWhere = {
        status:    'CONFIRMED',
        startTime: { lte: now },
        endTime:   { gt:  now },
      };
    } else {
      // Bookings overlapping the requested date in location-local time.
      // Use UTC ±14h window to cover any timezone, then filter precisely in-memory.
      const windowStart = new Date(`${date}T00:00:00Z`);
      windowStart.setUTCHours(windowStart.getUTCHours() - 14);
      const windowEnd = new Date(`${date}T23:59:59Z`);
      windowEnd.setUTCHours(windowEnd.getUTCHours() + 14);
      bookingWhere = {
        status:    'CONFIRMED',
        startTime: { lte: windowEnd },
        endTime:   { gte: windowStart },
      };
    }

    const resources = await this.prisma.resource.findMany({
      where: {
        locationId,
        status: 'ACTIVE',
        ...(type && { type: type as any }),
        ...(actorOrgId && { location: { organizationId: actorOrgId } }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        location: { select: { openTime: true, closeTime: true, timezone: true } },
        bookings: {
          where:   bookingWhere,
          select:  { id: true, startTime: true, endTime: true, user: { select: { firstName: true, lastName: true } } },
          orderBy: { startTime: 'asc' },
          take:    1,
        },
      },
    });

    // Compute nextAvailableSlot for ROOM resources on today.
    // All slot comparisons are done in location-local-time minutes.
    // `tz`, `todayLocal`, `isToday` are already resolved above from location.timezone.
    const toLocalMin = (d: Date) => {
      const t = d.toLocaleTimeString('sv-SE', { timeZone: tz });
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    let todayBookingsByResource: Record<string, { startMin: number; endMin: number }[]> = {};
    if (isToday) {
      const roomIds = resources.filter(r => r.type === 'ROOM').map(r => r.id);
      if (roomIds.length > 0) {
        // Conservative UTC window: today-in-local-tz spans at most UTC-14..UTC+14
        const windowStart = new Date(`${todayLocal}T00:00:00Z`);
        windowStart.setUTCHours(windowStart.getUTCHours() - 14);
        const windowEnd = new Date(`${todayLocal}T23:59:59Z`);
        windowEnd.setUTCHours(windowEnd.getUTCHours() + 14);
        const todayBookings = await this.prisma.booking.findMany({
          where: {
            resourceId: { in: roomIds },
            status:    'CONFIRMED',
            startTime: { lte: windowEnd },
            endTime:   { gte: windowStart },
          },
          select: { resourceId: true, startTime: true, endTime: true },
        });
        for (const b of todayBookings) {
          // Keep only bookings that actually touch today in location-local time
          const bDateLocal = b.startTime.toLocaleDateString('sv-SE', { timeZone: tz });
          const eeDateLocal = b.endTime.toLocaleDateString('sv-SE',   { timeZone: tz });
          if (bDateLocal !== todayLocal && eeDateLocal !== todayLocal) continue;
          if (!todayBookingsByResource[b.resourceId]) todayBookingsByResource[b.resourceId] = [];
          todayBookingsByResource[b.resourceId].push({
            startMin: toLocalMin(b.startTime),
            endMin:   toLocalMin(b.endTime),
          });
        }
      }
    }

    return resources.map(r => {
      const { bookings, location, ...rest } = r;
      let nextAvailableSlot: string | null = null;

      if (r.type === 'ROOM' && isToday) {
        const loc = location as any;
        const [openH,  openM]  = (loc?.openTime  ?? '08:00').split(':').map(Number);
        const [closeH, closeM] = (loc?.closeTime ?? '20:00').split(':').map(Number);
        const openTotal  = openH  * 60 + openM;
        const closeTotal = closeH * 60 + closeM;
        const nowLocalStr = now.toLocaleTimeString('sv-SE', { timeZone: tz });
        const [nowH, nowM] = nowLocalStr.split(':').map(Number);
        const nowMin = nowH * 60 + nowM;
        const startMin = Math.max(openTotal, nowMin);
        // Round up to next 30-min boundary
        const roundedStart = Math.ceil(startMin / 30) * 30;
        const rBookings = todayBookingsByResource[r.id] ?? [];

        for (let m = roundedStart; m + 30 <= closeTotal; m += 30) {
          const slotEnd = m + 30;
          // Conflict if any booking overlaps [m, slotEnd) in location-local minutes
          const conflict = rBookings.find(b => b.startMin < slotEnd && b.endMin > m);
          if (!conflict) {
            const slotH = String(Math.floor(m / 60)).padStart(2, '0');
            const slotM = String(m % 60).padStart(2, '0');
            nextAvailableSlot = `${slotH}:${slotM}`;
            break;
          }
        }
      }

      return { ...rest, currentBooking: bookings[0] ?? null, nextAvailableSlot };
    });
  }

  async findOne(id: string, actorOrgId?: string) {
    const r = await this.prisma.resource.findUnique({
      where:   { id },
      include: { location: { select: { name: true, organizationId: true } } },
    });
    if (!r) throw new NotFoundException('Resource not found');
    if (actorOrgId && (r.location as any).organizationId !== actorOrgId) {
      throw new ForbiddenException('Access denied');
    }
    return r;
  }

  async create(locationId: string, dto: {
    type: string; name: string; code: string; description?: string;
    capacity?: number; amenities?: string[]; vehicleType?: string;
    floor?: string; zone?: string;
  }, actorOrgId?: string) {
    if (actorOrgId) {
      const loc = await this.prisma.location.findUnique({
        where:  { id: locationId },
        select: { organizationId: true },
      });
      if (!loc || loc.organizationId !== actorOrgId) {
        throw new ForbiddenException('Location not in your organization');
      }
    }
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
  }>, actorOrgId?: string) {
    if (actorOrgId) await this.assertResourceInOrg(id, actorOrgId);
    return this.prisma.resource.update({ where: { id }, data: dto });
  }

  async remove(id: string, actorOrgId?: string) {
    if (actorOrgId) await this.assertResourceInOrg(id, actorOrgId);
    return this.prisma.resource.update({
      where: { id },
      data:  { status: 'INACTIVE' },
    });
  }

  // ── Dostępność zasobu na dany dzień ───────────────────────────
  async getAvailability(resourceId: string, date: string, actorOrgId?: string) {
    if (actorOrgId) await this.assertResourceInOrg(resourceId, actorOrgId);

    const resource = await this.prisma.resource.findUnique({
      where:   { id: resourceId },
      include: { location: { select: { name: true, organizationId: true, openTime: true, closeTime: true, parkingBookingMode: true, timezone: true } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const loc = resource.location as any;
    const tz  = loc?.timezone ?? 'Europe/Warsaw';

    // Use ±14h UTC window to cover any timezone, then filter in-memory by local date
    const windowStart = new Date(`${date}T00:00:00Z`);
    windowStart.setUTCHours(windowStart.getUTCHours() - 14);
    const windowEnd = new Date(`${date}T23:59:59Z`);
    windowEnd.setUTCHours(windowEnd.getUTCHours() + 14);

    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status:    'CONFIRMED',
        startTime: { lte: windowEnd },
        endTime:   { gte: windowStart },
      },
      select: { id: true, startTime: true, endTime: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { startTime: 'asc' },
    });

    // ALL_DAY mode — jeden slot "cały dzień" dla parkingu
    const isAllDay = resource.type === 'PARKING' && loc?.parkingBookingMode === 'ALL_DAY';

    if (isAllDay) {
      const conflict = bookings[0] ?? null;
      return {
        resource, date, bookings,
        allDayMode: true,
        available:  !conflict,
        currentBooking: conflict,
        slots: [],
        openTime:  loc?.openTime  ?? null,
        closeTime: loc?.closeTime ?? null,
      };
    }

    // HOURLY — standardowe sloty 30-minutowe w czasie lokalnym lokalizacji
    const [openH,  openM]  = (loc?.openTime  ?? '08:00').split(':').map(Number);
    const [closeH, closeM] = (loc?.closeTime ?? '20:00').split(':').map(Number);
    const openTotal  = openH  * 60 + openM;
    const closeTotal = closeH * 60 + closeM;

    // Convert booking times to local minutes for comparison
    const toLocalMin = (d: Date) => {
      const t = d.toLocaleTimeString('sv-SE', { timeZone: tz });
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const bookingSlots = bookings
      .filter(b => {
        const bDate = b.startTime.toLocaleDateString('sv-SE', { timeZone: tz });
        const eDate = b.endTime.toLocaleDateString('sv-SE',   { timeZone: tz });
        return bDate === date || eDate === date;
      })
      .map(b => ({ id: b.id, startMin: toLocalMin(b.startTime), endMin: toLocalMin(b.endTime), raw: b }));

    const slots: { time: string; available: boolean; bookingId?: string }[] = [];
    for (let totalMin = openTotal; totalMin + 30 <= closeTotal; totalMin += 30) {
      const slotEnd  = totalMin + 30;
      const conflict = bookingSlots.find(b => b.startMin < slotEnd && b.endMin > totalMin);
      const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const mm = String(totalMin % 60).padStart(2, '0');
      slots.push({ time: `${hh}:${mm}`, available: !conflict, bookingId: conflict?.id });
    }

    return {
      resource, date, bookings, allDayMode: false, slots,
      openTime:  loc?.openTime  ?? null,
      closeTime: loc?.closeTime ?? null,
    };
  }

  // ── Utwórz booking z walidacją konfliktów ─────────────────────
  async createBooking(
    resourceId: string,
    actorId: string,
    actorRole: string,
    dto: {
      date: string; startTime: string; endTime: string;
      notes?: string; allDay?: boolean; targetUserId?: string;
    },
    actorOrgId?: string,
  ) {
    // Fetch resource with location data for validation; also replaces assertResourceInOrg
    const resource = await this.prisma.resource.findUnique({
      where:   { id: resourceId },
      include: { location: { select: { organizationId: true, parkingBookingMode: true, timezone: true, openTime: true, closeTime: true } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (actorOrgId && (resource.location as any)?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Access denied');
    }

    const resLoc = resource.location as any;
    if (resource.type === 'PARKING' && resLoc?.parkingBookingMode === 'ALL_DAY' && !dto.allDay) {
      throw new ConflictException('To miejsce parkingowe jest w trybie całodniowym. Użyj allDay: true.');
    }

    // targetUserId validation
    let userId = actorId;
    if (dto.targetUserId) {
      if (!['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(actorRole)) {
        throw new ForbiddenException('Only admins can book on behalf of others');
      }
      if (!actorOrgId) {
        throw new ForbiddenException('Organization context required for cross-user bookings');
      }
      if (actorOrgId) {
        const targetUser = await this.prisma.user.findUnique({
          where:  { id: dto.targetUserId },
          select: { organizationId: true },
        });
        if (!targetUser || targetUser.organizationId !== actorOrgId) {
          throw new ForbiddenException('Target user not found in your organization');
        }
      }
      userId = dto.targetUserId;
    }

    let start = new Date(dto.startTime);
    let end   = new Date(dto.endTime);

    if (dto.allDay) {
      // Anchor at UTC noon — correct local date for any timezone UTC-11..UTC+11
      start = new Date(`${dto.date}T12:00:00.000Z`);
      end   = new Date(`${dto.date}T12:00:00.000Z`);
    }

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

    const booking = await this.prisma.booking.create({
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
    this.notificationsService.notifyBookingConfirmed(booking.id).catch(() => {});
    return booking;
  }

  async cancelBooking(bookingId: string, userId: string, role: string, actorOrgId?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    // Cross-tenant check via resourceId (avoids null-crash when resource is soft-deleted)
    if (actorOrgId && booking.resourceId) {
      await this.assertResourceInOrg(booking.resourceId, actorOrgId);
    }
    // Własna rezerwacja lub Admin+
    if (booking.userId !== userId && !['SUPER_ADMIN','OFFICE_ADMIN'].includes(role)) {
      throw new ConflictException('Brak uprawnień do anulowania tej rezerwacji');
    }
    const cancelled = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    this.notificationsService.notifyBookingCancelled(bookingId).catch(() => {});
    return cancelled;
  }

  // ── All bookings (admin view) ─────────────────────────────────
  async allBookings(filters: {
    actorOrgId?: string; date?: string; locationId?: string; type?: string;
  }) {
    if (filters.type && !ResourcesService.ALLOWED_TYPES.includes(filters.type)) {
      throw new BadRequestException('Invalid resource type');
    }
    const where: any = { status: 'CONFIRMED' };
    if (filters.actorOrgId || filters.locationId) {
      where.resource = {
        location: {
          ...(filters.actorOrgId && { organizationId: filters.actorOrgId }),
          ...(filters.locationId && { id: filters.locationId }),
        },
      };
    }
    if (filters.type) {
      where.resource = { ...(where.resource ?? {}), type: filters.type };
    }
    if (filters.date) {
      const d    = new Date(`${filters.date}T00:00:00.000Z`);
      const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1);
      where.startTime = { gte: d, lt: next };
    }
    return this.prisma.booking.findMany({
      where,
      include: {
        resource: { select: { name: true, type: true, code: true,
          location: { select: { name: true, timezone: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
      take:    500,
    });
  }

  // ── My bookings ───────────────────────────────────────────────
  async myBookings(userId: string, fromDate?: string, includeHistory = false) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const where: any = { userId, status: 'CONFIRMED' };
    if (!includeHistory) where.endTime = { gte: from };
    return this.prisma.booking.findMany({
      where,
      include: { resource: { select: { id: true, name: true, type: true, code: true, location: { select: { name: true, timezone: true } } } } },
      orderBy: includeHistory ? { startTime: 'desc' } : { startTime: 'asc' },
      take:    includeHistory ? 50 : 20,
    });
  }
}
