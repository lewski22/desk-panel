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

@Injectable()
export class DesksService {
  constructor(private prisma: PrismaService) {}

  async findAll(locationId: string) {
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

  async findOne(id: string) {
    const desk = await this.prisma.desk.findUnique({
      where: { id },
      include: {
        device: true,
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
    return desk;
  }

  async create(locationId: string, dto: CreateDeskDto) {
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
    return this.prisma.desk.update({ where: { id }, data: dto });
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

  async getAvailability(id: string, date: string) {
    await this.findOne(id);
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

  async getCurrentStatus(locationId: string) {
    const now = new Date();
    const desks = await this.prisma.desk.findMany({
      where: { locationId, status: DeskStatus.ACTIVE },
      include: {
        device:   { select: { isOnline: true } },
        location: { select: { openTime: true, closeTime: true, maxDaysAhead: true, maxHoursPerDay: true, timezone: true } },
        checkins: {
          where: { checkedOutAt: null },
          take: 1,
          orderBy: { checkedInAt: 'desc' },
        },
        reservations: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] },
            // Pokaż rezerwację aktywną LUB zaplanowaną na dziś (bez limitu 30min)
            // Użytkownik może check-in przez QR o każdej porze dnia
            endTime: { gte: now },
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

    // Limity z lokalizacji — takie same dla wszystkich biurek w tej lokalizacji
    // Zwracamy je raz na poziomie odpowiedzi żeby frontend nie musiał robić osobnego zapytania
    const firstDesk = desks[0];
    const locationLimits = firstDesk ? {
      openTime:       firstDesk.location?.openTime       ?? '08:00',
      closeTime:      firstDesk.location?.closeTime      ?? '17:00',
      maxDaysAhead:   firstDesk.location?.maxDaysAhead   ?? 14,
      maxHoursPerDay: firstDesk.location?.maxHoursPerDay ?? 8,
      timezone:       firstDesk.location?.timezone       ?? 'Europe/Warsaw',
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
        currentReservation: res ? {
          id:        res.id,
          userId:    res.userId,
          user:      res.user,
          startTime: res.startTime.toISOString(),
          endTime:   res.endTime.toISOString(),
          qrToken:   res.qrToken,
        } : null,
      };
    });

    return { locationLimits, desks: mapped };
  }

  async activate(id: string, actorOrgId?: string) {
    await this.assertDeskInOrg(id, actorOrgId);
    return this.prisma.desk.update({ where: { id }, data: { status: DeskStatus.ACTIVE } });
  }

  async unassignDevice(id: string) {
    await this.findOne(id);
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
}
