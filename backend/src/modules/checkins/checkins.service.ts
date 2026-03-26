import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CheckinMethod, ReservationStatus, EventType } from '@prisma/client';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  // ── NFC scan from beacon via MQTT ────────────────────────────
  async checkinNfc(deskId: string, cardUid: string, gatewayId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({ where: { cardUid } });
    if (!user) {
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

    const existing = await this.prisma.checkin.findUnique({
      where: { reservationId: reservation.id },
    });
    if (existing && !existing.checkedOutAt) {
      return { authorized: true, alreadyCheckedIn: true, checkin: existing };
    }

    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId: reservation.id, deskId, userId: user.id, method: CheckinMethod.NFC, cardUid },
      }),
      // Mark check-in time on reservation
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { checkedInAt: now, checkedInMethod: 'NFC' },
      }),
    ]);

    await this.logEvent(EventType.CHECKIN_NFC, {
      deskId, userId: user.id, checkinId: checkin.id, reservationId: reservation.id,
    });

    return { authorized: true, checkin };
  }

  // ── QR check-in — user has an existing reservation ───────────
  async checkinQr(userId: string, deskId: string, qrToken: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { deskId, userId, qrToken, status: ReservationStatus.CONFIRMED },
    });

    if (!reservation) {
      throw new ForbiddenException('Nieprawidłowy kod QR lub brak pasującej rezerwacji');
    }

    const existing = await this.prisma.checkin.findUnique({
      where: { reservationId: reservation.id },
    });
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
    return checkin;
  }

  // ── Walk-in QR — no reservation, desk must be free ───────────
  // Creates reservation + check-in in one transaction
  async walkinQr(userId: string, deskId: string) {
    const now = new Date();

    // Check desk is active
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { id: true, status: true, name: true },
    });
    if (!desk || desk.status !== 'ACTIVE') {
      throw new BadRequestException('Biurko niedostępne');
    }

    // Check not occupied right now
    const activeCheckin = await this.prisma.checkin.findFirst({
      where: { deskId, checkedOutAt: null },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (activeCheckin) {
      throw new ConflictException('To biurko jest już zajęte przez kogoś innego. Wybierz inne biurko.');
    }

    // Check no active reservation from someone else
    const conflictRes = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status: ReservationStatus.CONFIRMED,
        userId: { not: userId },
        startTime: { lte: new Date(now.getTime() + 15 * 60 * 1000) },
        endTime:   { gt: now },
      },
    });
    if (conflictRes) {
      throw new ConflictException('To biurko jest już zajęte przez kogoś innego. Wybierz inne biurko.');
    }

    // Create reservation (today, now → end of day) + check-in atomically
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);

    const [reservation, checkin] = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          deskId,
          userId,
          date:      startOfDay,
          startTime: now,
          endTime:   endOfDay,
          status:    ReservationStatus.CONFIRMED,
          checkedInAt:     now,
          checkedInMethod: 'QR',
        },
      });
      const ci = await tx.checkin.create({
        data: {
          reservationId: res.id,
          deskId,
          userId,
          method: CheckinMethod.QR,
        },
      });
      return [res, ci];
    });

    await this.logEvent(EventType.CHECKIN_QR, {
      deskId, userId, checkinId: checkin.id, reservationId: reservation.id, walkin: true,
    });

    return { checkin, reservation, deskName: desk.name };
  }

  // ── Manual check-in via Staff panel ─────────────────────────
  async checkinManual(deskId: string, userId: string, reservationId?: string) {
    const now = new Date();
    const checkin = await this.prisma.checkin.create({
      data: {
        ...(reservationId && { reservationId }),
        deskId,
        userId,
        method: CheckinMethod.MANUAL,
      },
    });

    if (reservationId) {
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data:  { checkedInAt: now, checkedInMethod: 'MANUAL' },
      });
    }

    await this.logEvent(EventType.CHECKIN_MANUAL, { deskId, userId, checkinId: checkin.id });
    return checkin;
  }

  // ── Checkout ─────────────────────────────────────────────────
  async checkout(checkinId: string, actorId: string, actorRole: string) {
    const checkin = await this.prisma.checkin.findUnique({ where: { id: checkinId } });
    if (!checkin)               throw new NotFoundException('Checkin not found');
    if (checkin.checkedOutAt)   throw new ConflictException('Already checked out');

    if (
      checkin.userId !== actorId &&
      !['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'].includes(actorRole)
    ) {
      throw new ForbiddenException('Not allowed');
    }

    const updated = await this.prisma.checkin.update({
      where: { id: checkinId },
      data:  { checkedOutAt: new Date() },
    });

    await this.logEvent(EventType.CHECKOUT, { checkinId, deskId: checkin.deskId, actorId });
    return updated;
  }

  private async logEvent(type: EventType, payload: object) {
    await this.prisma.event.create({ data: { type, payload } });
  }
}
