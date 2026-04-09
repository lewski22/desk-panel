import {
  Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService }    from '../../database/prisma.service';
import { LedEventsService } from '../../shared/led-events.service';
import { NfcScanService }   from '../../shared/nfc-scan.service';
import { CheckinMethod, ReservationStatus, EventType } from '@prisma/client';

/**
 * Oblicza koniec dnia pracy w strefie czasowej biura.
 * Używa Intl.DateTimeFormat (Node 20, bez zewnętrznych bibliotek).
 *
 * Algorytm: pobiera lokalną datę (YYYY-MM-DD) w danej strefie,
 * buduje string 'YYYY-MM-DDTHH:MM:00' i parsuje go jako czas lokalny
 * przez różnicę między UTC a strefą biura w tym momencie.
 */
function endOfWorkInTz(closeTime: string, timezone: string, now: Date): Date {
  const [closeH, closeM] = closeTime.split(':').map(Number);

  // Pobierz lokalną datę biura jako YYYY-MM-DD
  const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    .format(now);  // np. '2026-04-07'

  // Zbuduj czas zamknięcia jako string ISO w strefie biura
  const localCloseStr = `${localDateStr}T${String(closeH).padStart(2,'0')}:${String(closeM).padStart(2,'0')}:00`;

  // Oblicz przesunięcie strefy biura przez porównanie dwóch Date.toLocaleString
  const utcMs   = Date.parse(new Date(now).toLocaleString('en-US', { timeZone: 'UTC' }));
  const localMs = Date.parse(new Date(now).toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = localMs - utcMs;  // np. +7200000 dla UTC+2

  // Czas zamknięcia jako UTC
  return new Date(Date.parse(localCloseStr) - offsetMs);
}

@Injectable()
export class CheckinsService {
  private readonly logger = new Logger(CheckinsService.name);
  constructor(
    private prisma:     PrismaService,
    private ledEvents:  LedEventsService,
    private nfcScan:    NfcScanService,
  ) {}

  // ── NFC scan from beacon via MQTT ────────────────────────────
  async checkinNfc(deskId: string, cardUid: string, gatewayId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({ where: { cardUid } });
    if (!user || !user.isActive) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, { deskId, cardUid, gatewayId });
      // Jeśli admin czeka na skan (tryb auto-assign), przechwytujemy kartę
      this.nfcScan.notifyScan(cardUid);
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

    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId: reservation.id, deskId, userId: user.id, method: CheckinMethod.NFC, cardUid },
      }),
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { checkedInAt: now, checkedInMethod: 'NFC' },
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

    const closeTime = desk.location?.closeTime ?? '17:00';
    const timezone  = desk.location?.timezone  ?? 'Europe/Warsaw';
    const endOfWork = endOfWorkInTz(closeTime, timezone, now);

    if (now > endOfWork) {
      throw new BadRequestException(`Biuro zamknięte o ${closeTime} (${timezone}). Walk-in niemożliwy.`);
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
  async manual(deskId: string, userId: string, reservationId?: string, actorOrgId?: string) {
    const now = new Date();

    // Weryfikacja: biurko musi należeć do organizacji aktora (STAFF nie może robić checkin w obcej org)
    if (actorOrgId) {
      const desk = await this.prisma.desk.findFirst({
        where: { id: deskId },
        include: { location: { select: { organizationId: true } } },
      });
      if (!desk) throw new NotFoundException('Biurko nie istnieje');
      if (desk.location.organizationId !== actorOrgId) {
        throw new ForbiddenException('Biurko należy do innej organizacji');
      }
    }

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
  async checkout(reservationId: string, actorId: string, actorRole: string) {
    const checkin = await this.prisma.checkin.findUnique({ where: { reservationId } });
    if (!checkin) throw new NotFoundException('Brak aktywnego check-in');
    if (checkin.checkedOutAt) throw new ConflictException('Already checked out');

    // Tylko właściciel lub STAFF/ADMIN może zrobić checkout
    const elevated = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'].includes(actorRole);
    if (!elevated && checkin.userId !== actorId) {
      throw new ForbiddenException('Nie możesz zrobić checkout dla innego użytkownika');
    }

    const updated = await this.prisma.checkin.update({
      where: { reservationId },
      data:  { checkedOutAt: new Date() },
    });

    this.ledEvents.emit(checkin.deskId, 'FREE');
    return updated;
  }


  /**
   * Co 15 minut — auto-checkout dla check-inów bez checkout:
   *   1. Zakończono rezerwację (endTime < now) — checkout natychmiastowy
   *   2. Brak rezerwacji + checkin starszy niż 12h (walk-in bez check-out)
   * Emituje LED FREE dla każdego zwolnionego biurka.
   */
  @Cron('0 */15 * * * *')
  async autoCheckout() {
    const now = new Date();
    const staleWalkin = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h temu

    // Checkins gdzie rezerwacja wygasła
    const expiredCheckins = await this.prisma.checkin.findMany({
      where: {
        checkedOutAt: null,
        reservation: { endTime: { lt: now } },
      },
      select: { id: true, deskId: true, reservationId: true },
    });

    // Walk-in checkins (brak rezerwacji) starsze niż 12h
    const staleCheckins = await this.prisma.checkin.findMany({
      where: {
        checkedOutAt:  null,
        reservationId: null,
        checkedInAt:   { lt: staleWalkin },
      },
      select: { id: true, deskId: true },
    });

    const toClose = [...expiredCheckins, ...staleCheckins];
    if (toClose.length === 0) return;

    const ids = toClose.map(c => c.id);
    await this.prisma.checkin.updateMany({
      where: { id: { in: ids } },
      data:  { checkedOutAt: now },
    });

    // Powiadom beacon: biurko wolne
    const deskIds = [...new Set(toClose.map(c => c.deskId))];
    for (const deskId of deskIds) {
      this.ledEvents.emit(deskId, 'FREE');
    }

    this.logger.log(
      `Auto-checkout: ${expiredCheckins.length} expired-reservation + ${staleCheckins.length} stale walk-in`
    );
  }

  // ── Helpers ──────────────────────────────────────────────────
  private async logEvent(type: EventType, payload: object) {
    await this.prisma.event.create({
      data: { type, entityType: 'checkin', payload },
    }).catch(() => {});
  }
}
