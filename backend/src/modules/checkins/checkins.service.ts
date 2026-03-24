import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CheckinMethod, ReservationStatus, EventType } from '@prisma/client';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  // ── Called by MQTT bridge when beacon reports NFC scan ──────
  async checkinNfc(deskId: string, cardUid: string, gatewayId: string) {
    const now = new Date();

    // Find user by card UID
    const user = await this.prisma.user.findUnique({ where: { cardUid } });
    if (!user) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, { deskId, cardUid, gatewayId });
      return { authorized: false, reason: 'card_not_registered' };
    }

    // Find matching active reservation (±15 min grace period)
    const grace = 15 * 60 * 1000;
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        userId: user.id,
        status: ReservationStatus.CONFIRMED,
        startTime: { lte: new Date(now.getTime() + grace) },
        endTime: { gte: new Date(now.getTime() - grace) },
      },
    });

    if (!reservation) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, {
        deskId, cardUid, userId: user.id, reason: 'no_active_reservation',
      });
      return { authorized: false, reason: 'no_active_reservation' };
    }

    // Prevent double check-in
    const existing = await this.prisma.checkin.findUnique({
      where: { reservationId: reservation.id },
    });
    if (existing && !existing.checkedOutAt) {
      return { authorized: true, alreadyCheckedIn: true, checkin: existing };
    }

    const checkin = await this.prisma.checkin.create({
      data: {
        reservationId: reservation.id,
        deskId,
        userId: user.id,
        method: CheckinMethod.NFC,
        cardUid,
      },
    });

    await this.logEvent(EventType.CHECKIN_NFC, {
      deskId, userId: user.id, checkinId: checkin.id, reservationId: reservation.id,
    });

    return { authorized: true, checkin };
  }

  // ── QR scan from mobile app ──────────────────────────────────
  async checkinQr(userId: string, deskId: string, qrToken: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { deskId, userId, qrToken, status: ReservationStatus.CONFIRMED },
    });

    if (!reservation) {
      throw new ForbiddenException('Invalid QR token or no matching reservation');
    }

    const existing = await this.prisma.checkin.findUnique({
      where: { reservationId: reservation.id },
    });
    if (existing && !existing.checkedOutAt) {
      return existing;
    }

    const checkin = await this.prisma.checkin.create({
      data: {
        reservationId: reservation.id,
        deskId,
        userId,
        method: CheckinMethod.QR,
      },
    });

    await this.logEvent(EventType.CHECKIN_QR, {
      deskId, userId, checkinId: checkin.id,
    });

    return checkin;
  }

  // ── Manual check-in via Staff panel ─────────────────────────
  async checkinManual(deskId: string, userId: string, reservationId?: string) {
    let resolvedUserId = userId;

    if (reservationId) {
      const res = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      if (!res) throw new NotFoundException('Reservation not found');
      resolvedUserId = res.userId;
    }

    const checkin = await this.prisma.checkin.create({
      data: {
        ...(reservationId && { reservationId }),
        deskId,
        userId: resolvedUserId,
        method: CheckinMethod.MANUAL,
      },
    });

    await this.logEvent(EventType.CHECKIN_MANUAL, {
      deskId, userId: resolvedUserId, actorId: userId, checkinId: checkin.id,
    });

    return checkin;
  }

  // ── Checkout (any method) ────────────────────────────────────
  async checkout(checkinId: string, actorId: string, actorRole: string) {
    const checkin = await this.prisma.checkin.findUnique({
      where: { id: checkinId },
    });
    if (!checkin) throw new NotFoundException('Checkin not found');
    if (checkin.checkedOutAt) throw new ConflictException('Already checked out');

    if (
      checkin.userId !== actorId &&
      !['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'].includes(actorRole)
    ) {
      throw new ForbiddenException('Not allowed');
    }

    const updated = await this.prisma.checkin.update({
      where: { id: checkinId },
      data: { checkedOutAt: new Date() },
    });

    await this.logEvent(EventType.CHECKOUT, {
      checkinId, deskId: checkin.deskId, actorId,
    });

    return updated;
  }

  private async logEvent(type: EventType, payload: object) {
    await this.prisma.event.create({ data: { type, payload } });
  }
}
