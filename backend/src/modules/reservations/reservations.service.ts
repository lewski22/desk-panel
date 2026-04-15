import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService }  from '../../database/prisma.service';
import { LedEventsService } from '../../shared/led-events.service';
import { GatewaysService }        from '../gateways/gateways.service';
import { NotificationsService }   from '../notifications/notifications.service';
import { ReservationStatus } from '@prisma/client';
import { CreateReservationDto } from './dto/create-reservation.dto';



@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  constructor(
    private prisma:     PrismaService,
    private ledEvents:  LedEventsService,
    private gateways:   GatewaysService,
    private notify:     NotificationsService,
  ) {}

  async findAll(filters: {
    locationId?: string;
    deskId?: string;
    userId?: string;
    date?: string;
    status?: ReservationStatus;
    take?: number;
    actorOrgId?: string;  // ← WYMAGANE dla OFFICE_ADMIN/SUPER_ADMIN — izolacja org
  }) {
    return this.prisma.reservation.findMany({
      where: {
        // Zawsze filtruj przez organizację aktora (gdy przekazane)
        // Desk → Location → Organization — pełny łańcuch izolacji
        desk: {
          location: {
            ...(filters.actorOrgId  && { organizationId: filters.actorOrgId }),
            ...(filters.locationId  && { id: filters.locationId }),
          },
        },
        ...(filters.deskId     && { deskId: filters.deskId }),
        ...(filters.userId     && { userId: filters.userId }),
        ...(filters.date && (() => {
          const d = new Date(filters.date + 'T00:00:00.000Z');
          const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
          return { date: { gte: d, lt: next } };
        })()),
        ...(filters.status     && { status: filters.status }),
      },
      include: {
        desk: { select: { name: true, code: true, floor: true, zone: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
        // Include checkin data — method + time
        checkin: { select: { id: true, method: true, checkedInAt: true, checkedOutAt: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      // FIX: default limit to prevent unbounded query; callers can override
      take: filters.take ?? 500,
    });
  }

  async findOne(id: string, actorOrgId?: string) {
    const r = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        desk: { include: { location: { select: { organizationId: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        checkin: true,
      },
    });
    if (!r) throw new NotFoundException(`Reservation ${id} not found`);

    // Izolacja org — OFFICE_ADMIN/SUPER_ADMIN może widzieć tylko własną org
    if (actorOrgId && r.desk?.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Brak dostępu do tej rezerwacji');
    }
    return r;
  }

  async create(actorId: string, dto: CreateReservationDto, actorOrgId?: string) {
    // Staff/Admin mogą rezerwować dla konkretnego pracownika
    const userId = dto.targetUserId ?? actorId;

    // ── Pobierz biurko + limity lokalizacji ──────────────────
    const desk = await this.prisma.desk.findUnique({
      where: { id: dto.deskId },
      include: {
        location: {
          select: {
            organizationId: true,
            openTime:       true,
            closeTime:      true,
            maxDaysAhead:   true,
            maxHoursPerDay: true,
            timezone:       true,
          },
        },
      },
    });
    if (!desk) throw new NotFoundException('Biurko nie istnieje');

    // Izolacja org — sprawdź czy aktor należy do tej samej organizacji co biurko
    // actorOrgId null = OWNER (może rezerwować w każdej org — impersonacja)
    if (actorOrgId && desk.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Biurko nie należy do Twojej organizacji');
    }

    const loc  = desk.location;
    const now  = new Date();
    const resDate    = new Date(dto.date + 'T00:00:00.000Z');
    const startTime  = new Date(dto.startTime);
    const endTime    = new Date(dto.endTime);

    // ── Walidacja 1: Nie dalej niż maxDaysAhead dni ──────────
    const maxDate = new Date(now);
    maxDate.setUTCDate(maxDate.getUTCDate() + loc.maxDaysAhead);
    maxDate.setUTCHours(23, 59, 59, 999);
    if (resDate > maxDate) {
      throw new ConflictException(
        `Rezerwacja możliwa maksymalnie ${loc.maxDaysAhead} dni do przodu`
      );
    }

    // ── Walidacja 2: Długość rezerwacji ≤ maxHoursPerDay ─────
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > loc.maxHoursPerDay) {
      throw new ConflictException(
        `Rezerwacja nie może trwać dłużej niż ${loc.maxHoursPerDay} godzin`
      );
    }
    if (durationHours <= 0) {
      throw new ConflictException('Czas zakończenia musi być późniejszy niż startu');
    }

    // ── Walidacja 3: Godziny pracy biura ─────────────────────
    // Porównujemy HH:MM stringa z czasem lokalnym rezerwacji
    const [openH,  openM]  = loc.openTime.split(':').map(Number);
    const [closeH, closeM] = loc.closeTime.split(':').map(Number);
    const startHHMM = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endHHMM   = endTime.getUTCHours()   * 60 + endTime.getUTCMinutes();
    const openMin   = openH  * 60 + openM;
    const closeMin  = closeH * 60 + closeM;
    if (startHHMM < openMin || endHHMM > closeMin) {
      throw new ConflictException(
        `Rezerwacja musi mieścić się w godzinach pracy biura (${loc.openTime}–${loc.closeTime})`
      );
    }

    // Conflict check: same desk, same date, overlapping time, active status
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        deskId: dto.deskId,
        date: new Date(dto.date),
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        OR: [
          {
            startTime: { lt: new Date(dto.endTime) },
            endTime: { gt: new Date(dto.startTime) },
          },
        ],
      },
    });

    if (conflict) {
      throw new ConflictException(
        'Desk is already reserved for this time slot',
      );
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        deskId: dto.deskId,
        userId,
        date: new Date(dto.date),
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        notes: dto.notes,
        status: ReservationStatus.CONFIRMED,
      },
      include: {
        desk: { select: { name: true, code: true } },
      },
    });

    // Powiadom beacon o nowej rezerwacji — SET_RESERVATION z czasami
    this._notifyBeaconReservation(dto.deskId, reservation.startTime, reservation.endTime).catch(() => {});
    // Wyślij email potwierdzenia do pracownika
    this.notify.notifyReservationConfirmed(reservation.id).catch(() => {});

    return reservation;
  }

  async cancel(id: string, actorId: string, actorRole: string, actorOrgId?: string) {
    const reservation = await this.findOne(id, actorOrgId);

    // Only owner or admin/office-admin can cancel
    if (
      reservation.userId !== actorId &&
      !['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(actorRole)
    ) {
      throw new ForbiddenException('Not allowed to cancel this reservation');
    }

    if ([ReservationStatus.CANCELLED, ReservationStatus.COMPLETED].includes(reservation.status as any)) {
      throw new ConflictException('Reservation already closed');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data:  { status: ReservationStatus.CANCELLED },
    });

    // Zamknij otwarty checkin jeśli istnieje
    await this.prisma.checkin.updateMany({
      where: { reservationId: id, checkedOutAt: null },
      data:  { checkedOutAt: new Date() },
    });

    // Poinformuj beacon — ustaw LED na wolne
    try {
      this.ledEvents.emit(reservation.deskId, 'FREE');
      this._notifyBeaconReservation(reservation.deskId, null, null).catch(() => {});
      // Wyślij email o anulowaniu
      this.notify.notifyReservationCancelled(reservation.id).catch(() => {});
    } catch { /* MQTT may be offline */ }

    return updated;
  }

  async getQrToken(id: string, actorId: string) {
    const reservation = await this.findOne(id);
    if (reservation.userId !== actorId) {
      throw new ForbiddenException('Not your reservation');
    }
    return { qrToken: reservation.qrToken, deskId: reservation.deskId };
  }

  // Co 15 minut wygasaj przeterminowane rezerwacje CONFIRMED
  @Cron('0 */15 * * * *')
  async expireOld() {
    const now = new Date();
    const result = await this.prisma.reservation.updateMany({
      where: {
        status:  ReservationStatus.CONFIRMED,
        endTime: { lt: now },
      },
      data: { status: ReservationStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale reservation(s)`);
    }
    return result.count;
  }

  // M3: Moje rezerwacje — dla Outlook Add-in i Staff Panel
  async findMy(userId: string, date?: string, take = 50) {
    return this.prisma.reservation.findMany({
      where: {
        userId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        ...(date ? { date: new Date(date) } : {}),
      },
      include: {
        desk: { select: { id: true, name: true, code: true, floor: true, location: { select: { name: true } } } },
      },
      orderBy: { startTime: 'asc' },
      take,
    });
  }
  private async _notifyBeaconReservation(deskId: string, startTime: Date | null, endTime: Date | null) {
    try {
      const gatewayId = await this.gateways.findGatewayForDesk(deskId);
      if (!gatewayId) return;
      await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_RESERVATION', {
        start_unix: startTime ? Math.floor(startTime.getTime() / 1000) : 0,
        end_unix:   endTime   ? Math.floor(endTime.getTime()   / 1000) : 0,
      });
    } catch {
      // niestety gateway niedostępny — beacon użyje request_sync przy następnym połączeniu
    }
  }
}
