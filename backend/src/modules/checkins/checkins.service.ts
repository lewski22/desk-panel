import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService }    from '../../database/prisma.service';
import { LedEventsService } from '../../shared/led-events.service';
import { CheckinMethod, ReservationStatus, EventType } from '@prisma/client';

@Injectable()
export class CheckinsService {
  constructor(
    private prisma:     PrismaService,
    private ledEvents:  LedEventsService,
  ) {}

  // ── NFC scan from beacon via MQTT ────────────────────────────
  async checkinNfc(deskId: string, cardUid: string, gatewayId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({ where: { cardUid } });
    if (!user || !user.isActive) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, { deskId, cardUid, gatewayId });
      return { authorized: false, reason: 'card_not_registered' };
    }

    const grace = 15 * 60 * 1000;
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        userId: user.id,
        status: ReservationStatus.CONFIRMED,
        startTime: { lte: new Date(now.getTime() + grace) },
        endTime:   { gte: new Date(now.getTime() - grace) },
      },
    });

    if (!reservation) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, {
        deskId, cardUid, userId: user.id, reason: 'no_active_reservation',
      });
      return { authorized: false, reason: 'no_active_reservation' };
    }

    const existing = await this.prisma.checkin.findUnique({ where: { reservationId: reservation.id } });
    if (existing && !existing.checkedOutAt) return { authorized: true, alreadyCheckedIn: true, checkin: existing };

    const now2 = new Date();
    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId: reservation.id, deskId, userId: user.id, method: CheckinMethod.NFC, cardUid },
      }),
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { checkedInAt: now2, checkedInMethod: 'NFC' },
      }),
    ]);

    await this.logEvent(EventType.CHECKIN_NFC, {
      deskId, userId: user.id, checkinId: checkin.id, reservationId: reservation.id,
    });

    // Emituj zdarzenie LED — MqttHandlers nasłuchuje i publikuje
    this.ledEvents.emit(deskId, 'OCCUPIED');

    return { authorized: true, checkin };
  }

  // ── QR check-in — user ma rezerwację ─────────────────────────
  async checkinQr(userId: string, deskId: string, qrToken: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { deskId, userId, qrToken, status: ReservationStatus.CONFIRMED },
    });

    if (!reservation) {
      throw new ForbiddenException('Nieprawidłowy kod QR lub brak pasującej rezerwacji');
    }

    const existing = await this.prisma.checkin.findUnique({ where: { reservationId: reservation.id } });
    if (existing && !existing.checkedOutAt) return existing;

    const now = new Date();
    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId: reservation.id, deskId, userId, method: CheckinMethod.QR },
      }),
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { checkedInAt: now, checkedInMethod: 'QR' },
      }),
    ]);

    await this.logEvent(EventType.CHECKIN_QR, { deskId, userId, checkinId: checkin.id });

    this.ledEvents.emit(deskId, 'OCCUPIED');
    return checkin;
  }

  // ── Walk-in QR — brak rezerwacji, biurko musi być wolne ──────
  async walkinQr(userId: string, deskId: string) {
    const now = new Date();

    const desk = await this.prisma.desk.findUnique({
      where:   { id: deskId },
      include: { location: true },
    });
    if (!desk || desk.status !== 'ACTIVE') throw new NotFoundException('Biurko niedostępne');

    const closeTime = desk.location?.closeTime ?? '22:00';
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const endOfWork = new Date(now);
    endOfWork.setHours(closeH, closeM, 0, 0);

    if (now > endOfWork) {
      throw new BadRequestException(`Biuro zamknięte o ${closeTime}. Walk-in niemożliwy.`);
    }

    const activeCheckin = await this.prisma.checkin.findFirst({
      where: { deskId, checkedOutAt: null },
    });
    if (activeCheckin) {
      const ownActive = await this.prisma.checkin.findFirst({
        where: { deskId, userId, checkedOutAt: null },
        include: { reservation: true },
      });
      if (ownActive) {
        return {
          checkin: ownActive,
          reservation: ownActive.reservation,
          deskName: desk.name,
          endTime:  ownActive.reservation?.endTime ?? endOfWork,
          closeTime,
        };
      }
      throw new ConflictException('Biurko jest aktualnie zajęte');
    }

    const nextReservation = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status: ReservationStatus.CONFIRMED,
        userId: { not: userId },
        startTime: { gt: now, lte: endOfWork },
      },
      orderBy: { startTime: 'asc' },
    });

    const startOfDay = new Date(now.toDateString());
    const walkinEnd = nextReservation
      ? new Date(new Date(nextReservation.startTime).getTime() - 5 * 60 * 1000)
      : endOfWork;

    const [reservation, checkin] = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          deskId, userId,
          date:      startOfDay,
          startTime: now,
          endTime:   walkinEnd,
          status:    ReservationStatus.CONFIRMED,
          checkedInAt:     now,
          checkedInMethod: 'QR',
        },
      });
      const ci = await tx.checkin.create({
        data: { reservationId: res.id, deskId, userId, method: CheckinMethod.QR },
      });
      return [res, ci];
    });

    await this.logEvent(EventType.CHECKIN_QR, {
      deskId, userId, checkinId: checkin.id, reservationId: reservation.id, walkin: true,
    });

    this.ledEvents.emit(deskId, 'OCCUPIED');

    return { checkin, reservation, deskName: desk.name, endTime: walkinEnd, closeTime };
  }

  // ── Manual check-in via Staff panel ─────────────────────────
  async manual(deskId: string, userId: string, reservationId?: string) {
    const now = new Date();

    let reservation = reservationId
      ? await this.prisma.reservation.findUnique({ where: { id: reservationId } })
      : await this.prisma.reservation.findFirst({
          where: {
            deskId, userId, status: ReservationStatus.CONFIRMED,
            startTime: { lte: new Date(now.getTime() + 60 * 60 * 1000) },
            endTime:   { gte: now },
          },
        });

    if (!reservation) throw new NotFoundException('Brak aktywnej rezerwacji');

    const checkin = await this.prisma.checkin.create({
      data: { reservationId: reservation.id, deskId, userId, method: CheckinMethod.MANUAL },
    });

    await this.logEvent(EventType.CHECKIN_MANUAL, { deskId, userId, checkinId: checkin.id });

    this.ledEvents.emit(deskId, 'OCCUPIED');
    return checkin;
  }

  // ── Checkout ─────────────────────────────────────────────────
  async checkout(reservationId: string) {
    const checkin = await this.prisma.checkin.findUnique({ where: { reservationId } });
    if (!checkin) throw new NotFoundException('Brak aktywnego check-in');
    if (checkin.checkedOutAt) throw new ConflictException('Already checked out');

    const updated = await this.prisma.checkin.update({
      where: { reservationId },
      data:  { checkedOutAt: new Date() },
    });

    this.ledEvents.emit(checkin.deskId, 'FREE');
    return updated;
  }

  // ── Helpers ──────────────────────────────────────────────────
  private async logEvent(type: EventType, payload: object) {
    await this.prisma.event.create({
      data: { type, entityType: 'checkin', payload },
    }).catch(() => {});
  }
}
