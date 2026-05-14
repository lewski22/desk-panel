/**
 * CheckinsService — rejestrowanie obecności przy biurku.
 *
 * Obsługuje wszystkie metody meldowania:
 * - NFC: beacon skanuje kartę → gateway → checkinNfc()
 * - QR: użytkownik skanuje kod QR biurka → checkinQr()
 * - QR walk-in: check-in bez uprzedniej rezerwacji → walkinQr()
 * - Manual: pracownik melduje przez panel webowy → manual()
 * - Checkout: wymeldowanie przez NFC/QR/manual lub auto-wylogowanie
 *
 * Po każdym check-in/checkout emituje zdarzenie LED (LedEventsService → MQTT).
 * Dyspatchuje eventy do integracji (Slack/Teams/Webhook) fire-and-forget.
 * CRON co 5 minut: autoCheckout rezerwacji które przekroczyły endTime.
 *
 * backend/src/modules/checkins/checkins.service.ts
 */
import {
  Injectable, Logger, NotFoundException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { Cron }                    from '@nestjs/schedule';
import { ReservationStatus, CheckinMethod, EventType } from '@prisma/client';
import { PrismaService }           from '../../database/prisma.service';
import { LedEventsService }        from '../../shared/led-events.service';
import { NfcScanService }          from '../../shared/nfc-scan.service';
import { IntegrationEventService } from '../integrations/integration-event.service';

@Injectable()
export class CheckinsService {
  private readonly logger = new Logger(CheckinsService.name);

  constructor(
    private readonly prisma:            PrismaService,
    private readonly ledEvents:         LedEventsService,
    private readonly nfcScan:           NfcScanService,
    private readonly integrationEvents: IntegrationEventService,
  ) {}

  // ── NFC check-in — gateway forwards beacon scan ───────────────
  async checkinNfc(deskId: string, cardUid: string, gatewayId?: string, deviceId?: string) {
    const now = new Date();

    // Weryfikacja device → desk (zapobiega sfabrykowanym payloadom)
    if (deviceId) {
      const device = await this.prisma.device.findUnique({
        where:  { hardwareId: deviceId },
        select: { deskId: true },
      });
      if (device && device.deskId && device.deskId !== deskId) {
        await this.logEvent(EventType.UNAUTHORIZED_SCAN, {
          deskId, cardUid, gatewayId, deviceId,
          reason: 'device_desk_mismatch', expected: device.deskId,
        });
        return { authorized: false, reason: 'device_desk_mismatch' };
      }
    }

    const user = await this.prisma.user.findUnique({ where: { cardUid } });
    if (!user || !user.isActive) {
      await this.logEvent(EventType.UNAUTHORIZED_SCAN, { deskId, cardUid, gatewayId });
      this.nfcScan.notifyScan(cardUid);
      return { authorized: false, reason: 'card_not_registered' };
    }

    const grace = 15 * 60 * 1000; // 15 min grace window
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        deskId, userId: user.id,
        status:    ReservationStatus.CONFIRMED,
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
    if (existing && !existing.checkedOutAt) {
      return { authorized: true, alreadyCheckedIn: true, checkin: existing };
    }

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

    this.ledEvents.emit(deskId, 'OCCUPIED');

    // Sprint F — dispatch integration event (fire-and-forget)
    this.prisma.desk.findUnique({
      where:  { id: deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'nfc', {
        deskId,
        deskName:     d.name,
        userId:       user.id,
        userName:     `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        locationName: d.location.name,
      });
    }).catch(() => {});

    return { authorized: true, checkin };
  }

  // ── QR check-in — user has reservation ───────────────────────
  async checkinQr(userId: string, deskId: string, qrToken: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        deskId, userId, qrToken,
        status:    ReservationStatus.CONFIRMED,
        endTime:   { gte: new Date() },
      },
    });
    if (!reservation) throw new ForbiddenException('QR token invalid or reservation expired');

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

    await this.logEvent(EventType.CHECKIN_QR, {
      deskId, userId, checkinId: checkin.id, reservationId: reservation.id,
    });

    this.ledEvents.emit(deskId, 'OCCUPIED');

    // Sprint F — dispatch
    this.prisma.desk.findUnique({
      where:  { id: deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'qr', {
        deskId, deskName: d.name, userId, locationName: d.location.name,
      });
    }).catch(() => {});

    return checkin;
  }

  // ── QR walk-in — no reservation, creates one + checks in ─────
  async walkinQr(userId: string, deskId: string) {
    const desk = await this.prisma.desk.findUnique({
      where:   { id: deskId },
      include: { location: { select: { openTime: true, closeTime: true, timezone: true, organizationId: true, name: true } } },
    });
    if (!desk) throw new NotFoundException('Desk not found');
    if (desk.status !== 'ACTIVE') throw new ConflictException('Desk not available');

    const now      = new Date();
    const closeTime = desk.location?.closeTime ?? '18:00';
    const endOfWork = this._endOfWorkInTz(closeTime, desk.location?.timezone ?? 'Europe/Warsaw');

    // Sprawdź czy biurko jest aktualnie zajęte
    const activeCheckin = await this.prisma.checkin.findFirst({
      where: { deskId, checkedOutAt: null },
    });
    if (activeCheckin) {
      throw new ConflictException('Biurko jest aktualnie zajęte');
    }

    // Sprawdź następną rezerwację
    const nextReservation = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status:    ReservationStatus.CONFIRMED,
        userId:    { not: userId },
        startTime: { gt: now, lte: endOfWork },
      },
      orderBy: { startTime: 'asc' },
    });

    const walkinEnd = nextReservation
      ? new Date(new Date(nextReservation.startTime).getTime() - 5 * 60 * 1000)
      : endOfWork;

    const [reservation, checkin] = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          deskId, userId,
          date:      new Date(now.toDateString()),
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

    // Sprint F — dispatch
    this.prisma.desk.findUnique({
      where:  { id: deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'qr', {
        deskId, deskName: d.name, userId, locationName: d.location.name,
      });
    }).catch(() => {});

    return { checkin, reservation, deskName: desk.name, endTime: walkinEnd, closeTime };
  }

  // ── Manual check-in — Staff panel ────────────────────────────
  async manual(deskId: string, userId: string, reservationId?: string, actorOrgId?: string) {
    const now = new Date();

    if (actorOrgId) {
      const desk = await this.prisma.desk.findFirst({
        where:   { id: deskId },
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
            deskId, userId,
            status:    ReservationStatus.CONFIRMED,
            startTime: { lte: new Date(now.getTime() + 60 * 60 * 1000) },
            endTime:   { gte: now },
          },
        });

    if (!reservation) throw new NotFoundException('Brak aktywnej rezerwacji');

    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId: reservation.id, deskId, userId, method: CheckinMethod.MANUAL },
      }),
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { checkedInAt: now, checkedInMethod: 'MANUAL' },
      }),
    ]);

    await this.logEvent(EventType.CHECKIN_MANUAL, { deskId, userId, checkinId: checkin.id });

    this.ledEvents.emit(deskId, 'OCCUPIED');

    // Sprint F — dispatch
    this.prisma.desk.findUnique({
      where:  { id: deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'manual', {
        deskId, deskName: d.name, userId, locationName: d.location.name,
      });
    }).catch(() => {});

    return checkin;
  }

  // ── Web check-in — user self-checkin through browser ────────
  async checkinWeb(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id:     reservationId,
        userId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        endTime: { gte: new Date() },
      },
    });
    if (!reservation) throw new ForbiddenException('Brak rezerwacji lub brak dostępu');

    const now = new Date();
    // Web check-in is only available within 2 hours before reservation start
    if (now < new Date(reservation.startTime.getTime() - 2 * 60 * 60 * 1000)) {
      throw new ForbiddenException('Check-in przez przeglądarkę jest dostępny najwcześniej 2 godziny przed rezerwacją');
    }

    const existing = await this.prisma.checkin.findUnique({ where: { reservationId } });
    if (existing && !existing.checkedOutAt) return existing;
    const [checkin] = await this.prisma.$transaction([
      this.prisma.checkin.create({
        data: { reservationId, deskId: reservation.deskId, userId, method: CheckinMethod.WEB },
      }),
      this.prisma.reservation.update({
        where: { id: reservationId },
        data:  { checkedInAt: now, checkedInMethod: 'WEB' },
      }),
    ]);

    await this.logEvent(EventType.CHECKIN_MANUAL, { deskId: reservation.deskId, userId, checkinId: checkin.id, method: 'WEB' });
    this.ledEvents.emit(reservation.deskId, 'OCCUPIED');
    return checkin;
  }

  // ── Checkout ─────────────────────────────────────────────────
  async checkout(reservationId: string, actorId: string, actorRole: string) {
    const checkin = await this.prisma.checkin.findUnique({ where: { reservationId } });
    if (!checkin) throw new NotFoundException('Brak aktywnego check-in');
    if (checkin.checkedOutAt) throw new ConflictException('Already checked out');

    const elevated = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'].includes(actorRole);
    if (!elevated && checkin.userId !== actorId) {
      throw new ForbiddenException('Nie możesz zrobić checkout dla innego użytkownika');
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.checkin.update({
        where: { reservationId },
        data:  { checkedOutAt: now },
      }),
      this.prisma.reservation.update({
        where: { id: reservationId },
        data:  { status: ReservationStatus.COMPLETED },
      }),
    ]);

    const ledState = await this._deskLedAfterFree(checkin.deskId);
    this.ledEvents.emit(checkin.deskId, ledState);
    return updated;
  }

  // ── Cron: co 15 min auto-checkout ────────────────────────────
  @Cron('0 */15 * * * *')
  async autoCheckout() {
    const now         = new Date();
    const staleWalkin = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const expiredCheckins = await this.prisma.checkin.findMany({
      where: { checkedOutAt: null, reservation: { endTime: { lt: now } } },
      select: { id: true, deskId: true, reservationId: true },
    });

    const staleCheckins = await this.prisma.checkin.findMany({
      where: { checkedOutAt: null, reservationId: null, checkedInAt: { lt: staleWalkin } },
      select: { id: true, deskId: true },
    });

    const toClose = [...expiredCheckins, ...staleCheckins];
    if (toClose.length === 0) return;

    const ids = toClose.map(c => c.id);
    const reservationIds = expiredCheckins.map(c => c.reservationId).filter(Boolean) as string[];

    await this.prisma.$transaction([
      this.prisma.checkin.updateMany({ where: { id: { in: ids } }, data: { checkedOutAt: now } }),
      ...(reservationIds.length > 0 ? [this.prisma.reservation.updateMany({
        where: { id: { in: reservationIds } },
        data:  { status: ReservationStatus.COMPLETED },
      })] : []),
    ]);

    const deskIds = [...new Set(toClose.map(c => c.deskId))];
    for (const deskId of deskIds) {
      const state = await this._deskLedAfterFree(deskId);
      this.ledEvents.emit(deskId, state);
    }

    this.logger.log(
      `Auto-checkout: ${expiredCheckins.length} expired + ${staleCheckins.length} stale walk-in`
    );
  }

  // ── Parking QR check-in — użytkownik skanuje QR miejsca ─────
  async checkinParkingQr(userId: string, resourceQrToken: string) {
    const resource = await this.prisma.resource.findUnique({
      where:   { qrToken: resourceQrToken },
      include: { location: { select: { checkinGraceMinutes: true, timezone: true, name: true } } },
    });
    if (!resource) throw new NotFoundException('Nieprawidłowy QR kod miejsca');
    if (!resource.qrCheckinEnabled) {
      throw new ForbiddenException('QR check-in nie jest aktywny dla tego miejsca');
    }

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const booking = await this.prisma.booking.findFirst({
      where: {
        resourceId: resource.id,
        userId,
        status: 'CONFIRMED',
        date:   { gte: todayStart, lte: todayEnd },
      },
      orderBy: { startTime: 'asc' },
    });
    if (!booking) throw new ForbiddenException('Brak rezerwacji na to miejsce na dziś');

    const graceMs  = (resource.location?.checkinGraceMinutes ?? 15) * 60 * 1000;
    const earliest = new Date(booking.startTime.getTime() - graceMs);
    if (now < earliest) {
      const graceMin = resource.location?.checkinGraceMinutes ?? 15;
      throw new ForbiddenException(
        `Check-in możliwy od ${graceMin} min przed startem rezerwacji`,
      );
    }

    if (booking.checkedInAt) {
      return {
        alreadyCheckedIn: true,
        checkedInAt:  booking.checkedInAt,
        resourceName: resource.name,
        resourceCode: resource.code,
      };
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data:  { checkedInAt: now, checkedInBy: userId },
    });

    return {
      alreadyCheckedIn: false,
      checkedInAt:  updated.checkedInAt,
      resourceName: resource.name,
      resourceCode: resource.code,
      locationName: resource.location?.name,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  // Returns the LED state a desk should show after becoming free.
  // Emits RESERVED/GUEST_RESERVED if a same-day reservation is now visible; FREE otherwise.
  private async _deskLedAfterFree(deskId: string): Promise<'RESERVED' | 'GUEST_RESERVED' | 'FREE'> {
    const now = new Date();
    const candidate = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status:  { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        endTime: { gte: now },
      },
      select: {
        startTime:       true,
        reservationType: true,
        desk: { select: { location: { select: { openTime: true, timezone: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    if (!candidate) return 'FREE';

    const tz       = candidate.desk?.location?.timezone ?? 'Europe/Warsaw';
    const openTime = candidate.desk?.location?.openTime;
    const fmtDate  = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    if (fmtDate(now) !== fmtDate(candidate.startTime)) return 'FREE';

    if (openTime) {
      const toMin  = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
      const parts  = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).formatToParts(now);
      const nowMin = toMin(`${parts.find(p => p.type === 'hour')?.value ?? '0'}:${parts.find(p => p.type === 'minute')?.value ?? '0'}`);
      if (nowMin < toMin(openTime)) return 'FREE';
    }

    return (candidate.reservationType === 'GUEST' || candidate.reservationType === 'TEAM')
      ? 'GUEST_RESERVED'
      : 'RESERVED';
  }

  private async logEvent(type: EventType, payload: object) {
    await this.prisma.event.create({
      data: { type, entityType: 'checkin', payload },
    }).catch(() => {});
  }

  private _endOfWorkInTz(closeTime: string, timezone: string): Date {
    const now = new Date();
    const [h, m] = closeTime.split(':').map(Number);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(now)
        .filter(p => p.type !== 'literal')
        .map(p => [p.type, p.value])
    );

    const eow = new Date(Date.UTC(
      parseInt(parts.year),
      parseInt(parts.month) - 1,
      parseInt(parts.day),
      h - (timezone.includes('Warsaw') ? (now.getTimezoneOffset() === -120 ? 2 : 1) : 0),
      m, 0, 0,
    ));
    return eow;
  }
}
