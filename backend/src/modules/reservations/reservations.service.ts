import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LedEventsService } from '../../shared/led-events.service';
import { GatewaysService } from '../gateways/gateways.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma: PrismaService,
    private ledEvents: LedEventsService,
    private gateways: GatewaysService,
    private notify: NotificationsService,
  ) {}

  async findAll(filters: {
    locationId?: string;
    deskId?: string;
    userId?: string;
    date?: string;
    status?: ReservationStatus;
    take?: number;
    actorOrgId?: string;
  }) {
    return this.prisma.reservation.findMany({
      where: {
        desk: {
          location: {
            ...(filters.actorOrgId && { organizationId: filters.actorOrgId }),
            ...(filters.locationId && { id: filters.locationId }),
          },
        },
        ...(filters.deskId && { deskId: filters.deskId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.date &&
          (() => {
            const d = new Date(`${filters.date}T00:00:00.000Z`);
            const next = new Date(d);
            next.setUTCDate(next.getUTCDate() + 1);
            return { date: { gte: d, lt: next } };
          })()),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        desk: { select: { name: true, code: true, floor: true, zone: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
        checkin: { select: { id: true, method: true, checkedInAt: true, checkedOutAt: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: filters.take ?? 500,
    });
  }

  async findOne(id: string, actorOrgId?: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        desk: { include: { location: { select: { organizationId: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        checkin: true,
      },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }

    if (actorOrgId && reservation.desk?.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Brak dostepu do tej rezerwacji');
    }

    return reservation;
  }

  async create(actorId: string, dto: CreateReservationDto, actorOrgId?: string) {
    const userId = dto.targetUserId ?? actorId;

    const desk = await this.prisma.desk.findUnique({
      where: { id: dto.deskId },
      include: {
        location: {
          select: {
            organizationId: true,
            openTime: true,
            closeTime: true,
            maxDaysAhead: true,
            maxHoursPerDay: true,
            timezone: true,
          },
        },
      },
    });
    if (!desk) {
      throw new NotFoundException('Biurko nie istnieje');
    }

    if (actorOrgId && desk.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Biurko nie nalezy do Twojej organizacji');
    }

    const loc = desk.location;
    const now = new Date();
    const resDate = new Date(`${dto.date}T00:00:00.000Z`);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const maxDate = new Date(now);
    maxDate.setUTCDate(maxDate.getUTCDate() + loc.maxDaysAhead);
    maxDate.setUTCHours(23, 59, 59, 999);
    if (resDate > maxDate) {
      throw new ConflictException(
        `Rezerwacja mozliwa maksymalnie ${loc.maxDaysAhead} dni do przodu`,
      );
    }

    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > loc.maxHoursPerDay) {
      throw new ConflictException(
        `Rezerwacja nie moze trwac dluzej niz ${loc.maxHoursPerDay} godzin`,
      );
    }
    if (durationHours <= 0) {
      throw new ConflictException('Czas zakonczenia musi byc pozniejszy niz startu');
    }

    const [openH, openM] = loc.openTime.split(':').map(Number);
    const [closeH, closeM] = loc.closeTime.split(':').map(Number);
    const startHHMM = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endHHMM = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    if (startHHMM < openMin || endHHMM > closeMin) {
      throw new ConflictException(
        `Rezerwacja musi miescic sie w godzinach pracy biura (${loc.openTime}-${loc.closeTime})`,
      );
    }

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
      throw new ConflictException('Desk is already reserved for this time slot');
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

    this._notifyBeaconReservation(dto.deskId, reservation.startTime, reservation.endTime).catch(() => {});
    this.notify.notifyReservationConfirmed(reservation.id).catch(() => {});

    return reservation;
  }

  async cancel(id: string, actorId: string, actorRole: string, actorOrgId?: string) {
    const reservation = await this.findOne(id, actorOrgId);

    if (
      reservation.userId !== actorId &&
      !['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(actorRole)
    ) {
      throw new ForbiddenException('Not allowed to cancel this reservation');
    }

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new ConflictException('Reservation already closed');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });

    await this.prisma.checkin.updateMany({
      where: { reservationId: id, checkedOutAt: null },
      data: { checkedOutAt: new Date() },
    });

    try {
      this.ledEvents.emit(reservation.deskId, 'FREE');
      this._notifyBeaconReservation(reservation.deskId, null, null).catch(() => {});
      this.notify.notifyReservationCancelled(reservation.id).catch(() => {});
    } catch {}

    return updated;
  }

  async getQrToken(id: string, actorId: string) {
    const reservation = await this.findOne(id);
    if (reservation.userId !== actorId) {
      throw new ForbiddenException('Not your reservation');
    }
    return { qrToken: reservation.qrToken, deskId: reservation.deskId };
  }

  @Cron('0 */15 * * * *')
  async expireOld() {
    const now = new Date();
    const result = await this.prisma.reservation.updateMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        endTime: { lt: now },
      },
      data: { status: ReservationStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale reservation(s)`);
    }

    return result.count;
  }

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

  private async _notifyBeaconReservation(
    deskId: string,
    startTime: Date | null,
    endTime: Date | null,
  ) {
    try {
      const gatewayId = await this.gateways.findGatewayForDesk(deskId);
      if (!gatewayId) {
        return;
      }

      await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_RESERVATION', {
        start_unix: startTime ? Math.floor(startTime.getTime() / 1000) : 0,
        end_unix: endTime ? Math.floor(endTime.getTime() / 1000) : 0,
      });
    } catch {
      // Gateway may be offline; beacon should resync later.
    }
  }

  async createRecurring(
    actorId: string,
    dto: CreateReservationDto & { recurrenceRule: string },
    actorOrgId?: string,
  ) {
    const groupId = `rg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dates = this._expandRule(new Date(dto.startTime), dto.recurrenceRule);
    const created: any[] = [];
    const conflicts: string[] = [];

    for (const date of dates) {
      const startTime = new Date(date);
      const endTime = new Date(date);
      const origStart = new Date(dto.startTime);
      const origEnd = new Date(dto.endTime);
      startTime.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
      endTime.setHours(origEnd.getHours(), origEnd.getMinutes(), 0, 0);

      const conflict = await this.prisma.reservation.findFirst({
        where: {
          deskId: dto.deskId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (conflict) {
        conflicts.push(date.toISOString().split('T')[0]);
        continue;
      }

      const reservation = await this.prisma.reservation.create({
        data: {
          deskId: dto.deskId,
          userId: actorId,
          date: startTime,
          startTime,
          endTime,
          notes: dto.notes,
          status: 'CONFIRMED',
          recurrenceRule: dto.recurrenceRule,
          recurrenceGroupId: groupId,
        },
      });
      created.push(reservation);
    }

    return { groupId, created, conflicts, total: dates.length };
  }

  async cancelRecurring(
    reservationId: string,
    scope: 'single' | 'following' | 'all',
    actorId: string,
    actorRole: string,
  ) {
    const reservation = await this.prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    if (!reservation.recurrenceGroupId) {
      return this.cancel(reservationId, actorId, actorRole);
    }

    let where: any = {};
    if (scope === 'single') {
      where = { id: reservationId };
    } else if (scope === 'following') {
      where = {
        recurrenceGroupId: reservation.recurrenceGroupId,
        startTime: { gte: reservation.startTime },
        status: { in: ['CONFIRMED', 'PENDING'] },
      };
    } else {
      where = {
        recurrenceGroupId: reservation.recurrenceGroupId,
        status: { in: ['CONFIRMED', 'PENDING'] },
      };
    }

    const { count } = await this.prisma.reservation.updateMany({
      where,
      data: { status: 'CANCELLED' },
    });

    return { cancelled: count, scope };
  }

  private _expandRule(startDate: Date, rule: string): Date[] {
    const parts: Record<string, string> = {};
    rule.replace(/^RRULE:/, '').split(';').forEach((part) => {
      const [k, v] = part.split('=');
      parts[k] = v;
    });

    const freq = parts.FREQ ?? 'WEEKLY';
    const count = parts.COUNT ? parseInt(parts.COUNT, 10) : 10;
    const byday = parts.BYDAY ? parts.BYDAY.split(',') : null;
    const until = parts.UNTIL ? new Date(parts.UNTIL) : null;

    const dayMap: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
    const targetDays = byday ? byday.map((day) => dayMap[day] ?? 1) : null;

    const dates: Date[] = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    let iterations = 0;
    const maxIter = 365;

    while (dates.length < count && iterations < maxIter) {
      iterations += 1;
      const dayOfWeek = cursor.getDay();
      const matches =
        freq === 'DAILY' ||
        (freq === 'WEEKLY' && (!targetDays || targetDays.includes(dayOfWeek)));

      if (matches) {
        if (until && cursor > until) {
          break;
        }
        dates.push(new Date(cursor));
      }

      cursor.setDate(cursor.getDate() + 1);
      if (freq === 'WEEKLY' && !targetDays && dates.length < count) {
        cursor.setDate(cursor.getDate() + 6);
      }
    }

    return dates;
  }
}
