/**
 * DesksService — zarządzanie biurkami i ich stanem operacyjnym.
 *
 * Odpowiada za:
 * - CRUD biurek z weryfikacją przynależności do org aktora (assertDeskInOrg)
 * - Obliczanie bieżącego statusu biurka (getCurrentStatus): FREE / OCCUPIED /
 *   RESERVED / GUEST_RESERVED na podstawie aktywnych rezerwacji i check-inów
 * - Emisję zdarzeń LED przez LedEventsService → GatewaysService → MQTT → beacon
 * - Pozycjonowanie na planie piętra (batchUpdatePositions)
 * - Soft-delete i hard-delete z kaskadowym usunięciem danych
 *
 * backend/src/modules/desks/desks.service.ts
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DeskStatus } from '@prisma/client';
import { CreateDeskDto } from './dto/create-desk.dto';
import { UpdateDeskDto } from './dto/update-desk.dto';
import { LedEventsService } from '../../shared/led-events.service';

@Injectable()
export class DesksService {
  constructor(
    private prisma: PrismaService,
    private ledEvents: LedEventsService, // FIX P2-4
  ) {}

  async findAll(locationId: string, actorOrgId?: string) {
    if (actorOrgId) await this.assertLocationInOrg(locationId, actorOrgId);
    return this.prisma.desk.findMany({
      where: { locationId },
      include: {
        device:   { select: { id: true, hardwareId: true, isOnline: true, lastSeen: true } },
        location: {
          select: {
            name:           true,
            openTime:       true,
            closeTime:      true,
            maxDaysAhead:   true,
            maxHoursPerDay: true,
            timezone:       true,
          },
        },
        _count:   { select: { reservations: true } },
      },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, actorOrgId?: string) {
    const desk = await this.prisma.desk.findUnique({
      where: { id },
      include: {
        device: true,
        location: { select: { organizationId: true } },
        reservations: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            date: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
      },
    });
    if (!desk) throw new NotFoundException(`Desk ${id} not found`);
    if (actorOrgId && desk.location.organizationId !== actorOrgId) {
      throw new ForbiddenException('Biurko nie należy do Twojej organizacji');
    }
    return desk;
  }

  async create(locationId: string, dto: CreateDeskDto, actorOrgId?: string) {
    if (actorOrgId) await this.assertLocationInOrg(locationId, actorOrgId);
    const exists = await this.prisma.desk.findFirst({
      where: { locationId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException(
        `Desk with code "${dto.code}" already exists in this location`,
      );
    }
    return this.prisma.desk.create({
      data: { ...dto, locationId },
    });
  }


  // ── Org isolation guard ─────────────────────────────────────
  async assertLocationInOrg(locationId: string, actorOrgId: string): Promise<void> {
    const loc = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { organizationId: true },
    });
    if (!loc || loc.organizationId !== actorOrgId) {
      throw new ForbiddenException('Brak dostępu do tej lokalizacji');
    }
  }

  // Weryfikuje: Desk → Location → Organization
  // Rzuca ForbiddenException jeśli biurko nie należy do actorOrg.
  private async assertDeskInOrg(deskId: string, actorOrgId?: string): Promise<void> {
    if (!actorOrgId) return;  // OWNER — brak ograniczenia
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      include: { location: { select: { organizationId: true } } },
    });
    if (!desk) throw new NotFoundException(`Desk ${deskId} not found`);
    if (desk.location.organizationId !== actorOrgId) {
      throw new ForbiddenException('Biurko nie należy do Twojej organizacji');
    }
  }

  async update(id: string, dto: UpdateDeskDto, actorOrgId?: string) {
    await this.assertDeskInOrg(id, actorOrgId);
    const updated = await this.prisma.desk.update({ where: { id }, data: dto });
    // FIX P2-4: signal beacon LED on MAINTENANCE toggle — fire-and-forget
    if (dto.status === 'MAINTENANCE') {
      this.ledEvents.emit(id, 'ERROR'); // amber/unavailable state
    } else if (dto.status === 'ACTIVE') {
      this.ledEvents.emit(id, 'FREE');  // revert to idle green
    }
    return updated;
  }

  async remove(id: string, actorOrgId?: string) {
    await this.assertDeskInOrg(id, actorOrgId);
    return this.prisma.desk.update({
      where: { id },
      data: { status: DeskStatus.INACTIVE },
    });
  }

  async hardDelete(id: string, actorOrgId?: string) {
    await this.assertDeskInOrg(id, actorOrgId);

    // Przed usunięciem: anuluj/zakończ wszystkie aktywne rezerwacje i checkout otwarte checkins
    // (CASCADE usunie rekordy, ale chcemy mieć spójny stan dla audytu)
    const now = new Date();
    await this.prisma.reservation.updateMany({
      where: {
        deskId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.checkin.updateMany({
      where: { deskId: id, checkedOutAt: null },
      data:  { checkedOutAt: now },
    });

    await this.prisma.desk.delete({ where: { id } });
    return { deleted: true };
  }

  async getAvailability(id: string, date: string, actorOrgId?: string) {
    await this.findOne(id, actorOrgId);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        deskId: id,
        date: new Date(date),
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' },
    });
    return { deskId: id, date, bookedSlots: reservations };
  }

  async getCurrentStatus(locationId: string, actorRole?: string, date?: string) {
    const isEndUser = actorRole === 'END_USER';
    const now = new Date();

    // Phase 1: resolve timezone from location (needed to compute dayStr before main query)
    const locRow = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { timezone: true, openTime: true, closeTime: true, maxDaysAhead: true, maxHoursPerDay: true },
    });
    const tz = locRow?.timezone ?? 'Europe/Warsaw';

    // Determine target day string (YYYY-MM-DD) in the location's timezone
    const dayStr  = date ?? now.toLocaleDateString('sv-SE', { timeZone: tz });
    const isToday = dayStr === now.toLocaleDateString('sv-SE', { timeZone: tz });

    // Day boundaries in UTC (wall-clock convention: 00:00–23:59:59 local)
    const dayStart = new Date(`${dayStr}T00:00:00.000Z`);
    const dayEnd   = new Date(`${dayStr}T23:59:59.999Z`);

    // Phase 2: fetch desks — location fields already resolved from locRow, skip re-include
    const desks = await this.prisma.desk.findMany({
      where: { locationId, status: DeskStatus.ACTIVE },
      include: {
        device:   { select: { isOnline: true } },
        checkins: {
          where: isToday
            ? {
                checkedOutAt: null,
                OR: [
                  { reservation: { endTime: { gte: now } } },
                  { reservationId: null, checkedInAt: { gte: new Date(now.getTime() - 12 * 3600 * 1000) } },
                ],
              }
            : { id: 'never' },
          take: isToday ? 1 : 0,
          orderBy: { checkedInAt: 'desc' as const },
          select: {
            userId:      true,
            checkedInAt: true,
            user:        { select: { firstName: true, lastName: true, email: true } },
          },
        },
        reservations: {
          where: {
            status:    { in: ['CONFIRMED', 'PENDING'] },
            date:      new Date(`${dayStr}T00:00:00.000Z`),
            startTime: { lt: dayEnd },
            endTime:   { gt: isToday ? now : dayStart },
          },
          take: 1,
          orderBy: { startTime: 'asc' },
          select: {
            id:        true,
            userId:    true,
            qrToken:   true,
            startTime: true,
            endTime:   true,
            user:      { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Limity z lokalizacji — pobrane z locRow w Phase 1 (jeden wspólny zestaw dla całej lokalizacji)
    const locationLimits = locRow ? {
      openTime:       locRow.openTime       ?? '08:00',
      closeTime:      locRow.closeTime      ?? '17:00',
      maxDaysAhead:   locRow.maxDaysAhead   ?? 14,
      maxHoursPerDay: locRow.maxHoursPerDay ?? 8,
      timezone:       locRow.timezone       ?? 'Europe/Warsaw',
    } : null;

    const mapped = desks.map((d) => {
      const res = d.reservations[0] ?? null;
      return {
        id:         d.id,
        name:       d.name,
        code:       d.code,
        floor:      d.floor,
        zone:       d.zone,
        status:     d.status,
        isOnline:   d.device?.isOnline ?? false,
        isOccupied: d.checkins.length > 0,
        // Floor Plan position (Sprint D)
        posX:       d.posX     ?? null,
        posY:       d.posY     ?? null,
        rotation:   d.rotation ?? 0,
        width:      d.width    ?? 2,
        height:     d.height   ?? 1,
        currentCheckin: d.checkins[0] ? {
          userId:      isEndUser ? undefined : d.checkins[0].userId,
          checkedInAt: d.checkins[0].checkedInAt.toISOString(),
          user:        isEndUser ? undefined : d.checkins[0].user,
        } : null,
        currentReservation: res ? {
          id:        res.id,
          userId:    isEndUser ? undefined : res.userId,
          user:      isEndUser ? undefined : res.user,
          startTime: res.startTime.toISOString(),
          endTime:   res.endTime.toISOString(),
          qrToken:   isEndUser ? undefined : res.qrToken,
        } : null,
      };
    });

    return { locationLimits, desks: mapped };
  }

  async activate(id: string, actorOrgId?: string) {
    await this.assertDeskInOrg(id, actorOrgId);
    return this.prisma.desk.update({ where: { id }, data: { status: DeskStatus.ACTIVE } });
  }

  async unassignDevice(id: string, actorOrgId?: string) {
    await this.findOne(id, actorOrgId);
    const device = await this.prisma.device.findFirst({ where: { deskId: id } });
    if (!device) return { unlinked: false };
    await this.prisma.device.update({ where: { id: device.id }, data: { deskId: null } });
    return { unlinked: true, deviceId: device.id };
  }

  // Public endpoint — returns desk info by QR token (no auth needed)
  async getByQrToken(token: string) {
    const desk = await this.prisma.desk.findFirst({
      where: { qrToken: token, status: 'ACTIVE' },
      select: {
        id: true, name: true, code: true, floor: true, zone: true,
        qrToken: true,
        device: { select: { isOnline: true } },
        checkins: {
          // Tylko checkins z aktywną rezerwacją (endTime > now) lub walk-in z ostatnich 12h
          where: {
            checkedOutAt: null,
            OR: [
              { reservation: { endTime: { gte: new Date() } } },
              { reservationId: null, checkedInAt: { gte: new Date(Date.now() - 12 * 3600 * 1000) } },
            ],
          },
          select: { id: true, userId: true, checkedInAt: true },
          take: 1,
        },
        reservations: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            endTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 1,
          select: {
            id: true, startTime: true, endTime: true, qrToken: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!desk) return null;
    return {
      ...desk,
      isOccupied: desk.checkins.length > 0,
      currentReservation: desk.reservations[0] ?? null,
    };
  }

  // ── M3: Wolne biurka na dany slot czasowy (Outlook Add-in) ───
  async findAvailable(
    locationId: string,
    date:       string,   // YYYY-MM-DD
    startTime:  string,   // HH:MM
    endTime:    string,   // HH:MM
    requestingOrgId?: string, // organizationId zalogowanego użytkownika
  ) {
    // Scoping: weryfikuj czy lokalizacja należy do org użytkownika
    const location = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { id: true, organizationId: true },
    });
    if (!location) throw new NotFoundException(`Location ${locationId} not found`);
    if (requestingOrgId && location.organizationId !== requestingOrgId) {
      throw new ForbiddenException('Brak dostępu do tej lokalizacji');
    }
    const dateObj  = new Date(date);
    const startDt  = new Date(`${date}T${startTime}:00`);
    const endDt    = new Date(`${date}T${endTime}:00`);

    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      throw new BadRequestException('Nieprawidłowy format daty lub czasu (oczekiwany: YYYY-MM-DD, HH:MM)');
    }
    if (startDt >= endDt) {
      throw new BadRequestException('startTime musi być wcześniejszy niż endTime');
    }

    // Wszystkie aktywne biurka w lokalizacji
    const desks = await this.prisma.desk.findMany({
      where: { locationId, status: DeskStatus.ACTIVE },
      select: { id: true, name: true, code: true, floor: true, zone: true },
    });

    // ID biurek z kolizją rezerwacji w tym oknie
    const taken = await this.prisma.reservation.findMany({
      where: {
        deskId: { in: desks.map(d => d.id) },
        date:   dateObj,
        status: { in: ['PENDING', 'CONFIRMED'] },
        // nakładanie się okien: start < endTime AND end > startTime
        startTime: { lt: endDt },
        endTime:   { gt: startDt },
      },
      select: { deskId: true },
    });

    const takenIds = new Set(taken.map(r => r.deskId));
    return desks.filter(d => !takenIds.has(d.id));
  }

  // ── Sprint D: Batch update positions na floor plan ────────────
  // Przyjmuje tablicę { id, posX, posY, rotation, width, height }
  // Zapisuje wszystkie biurka w jednej transakcji (user klika "Zapisz")
  async batchUpdatePositions(
    updates:    { id: string; posX?: number; posY?: number; rotation?: number; width?: number; height?: number }[],
    actorOrgId?: string,
  ) {
    // Walidacja org — każde biurko musi należeć do org aktora
    if (actorOrgId && updates.length > 0) {
      const ids   = updates.map(u => u.id);
      const desks = await this.prisma.desk.findMany({
        where:   { id: { in: ids } },
        include: { location: { select: { organizationId: true } } },
      });
      const forbidden = desks.find(d => d.location?.organizationId !== actorOrgId);
      if (forbidden) {
        throw new Error(`Biurko ${forbidden.id} nie należy do Twojej organizacji`);
      }
    }

    // Transakcja — atomic update wszystkich pozycji
    const ops = updates.map(u =>
      this.prisma.desk.update({
        where: { id: u.id },
        data:  {
          ...(u.posX     !== undefined && { posX:     u.posX }),
          ...(u.posY     !== undefined && { posY:     u.posY }),
          ...(u.rotation !== undefined && { rotation: u.rotation }),
          ...(u.width    !== undefined && { width:    u.width }),
          ...(u.height   !== undefined && { height:   u.height }),
        },
        select: { id: true, posX: true, posY: true, rotation: true, width: true, height: true },
      })
    );
    return this.prisma.$transaction(ops);
  }

}