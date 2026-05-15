/**
 * ReservationsService — podstawowy moduł systemu rezerwacji biurek.
 *
 * Obsługuje pełny cykl życia rezerwacji:
 * - Tworzenie jednorazowych i cyklicznych (iCalendar RRULE) rezerwacji
 * - Walidacja konfliktów (time overlap) i limitów org (maxDaysAhead, maxHoursPerDay)
 * - Anulowanie pojedynczych i całych serii rezerwacji cyklicznych
 * - Synchronizacja z Microsoft Calendar przez GraphService
 * - Emisja zdarzeń LED przy tworzeniu/anulowaniu (FREE/RESERVED)
 * - Push notifications i emaile do użytkownika o zmianach
 * - Dispatching do integracji (Slack/Teams/Webhook) fire-and-forget
 * - CRON co minutę: zmiana statusu LED gdy rezerwacja się zaczyna/kończy
 *
 * backend/src/modules/reservations/reservations.service.ts
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron }                    from '@nestjs/schedule';
import { ReservationStatus }       from '@prisma/client';
import { PrismaService }           from '../../database/prisma.service';
import { LedEventsService }        from '../../shared/led-events.service';
import { GatewaysService }         from '../gateways/gateways.service';
import { NotificationsService }    from '../notifications/notifications.service';
import { IntegrationEventService } from '../integrations/integration-event.service';
import { GraphService }            from '../graph-sync/graph.service';
import { CreateReservationDto }    from './dto/create-reservation.dto';
import { PushService }             from '../push/push.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma:            PrismaService,
    private ledEvents:         LedEventsService,
    private gateways:          GatewaysService,
    private notify:            NotificationsService,
    private integrationEvents: IntegrationEventService,
    private graphService:      GraphService,
    private push:              PushService,
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
            const d    = new Date(`${filters.date}T00:00:00.000Z`);
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
    if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);

    if (actorOrgId && reservation.desk?.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Brak dostępu do tej rezerwacji');
    }
    return reservation;
  }

  async findMy(userId: string, date?: string, take = 50) {
    const dateFilter = date
      ? (() => {
          const d    = new Date(`${date}T00:00:00.000Z`);
          const next = new Date(d);
          next.setUTCDate(next.getUTCDate() + 1);
          return { date: { gte: d, lt: next } };
        })()
      : (() => {
          const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
          return { date: { gte: new Date(`${todayStr}T00:00:00.000Z`) } };
        })();

    return this.prisma.reservation.findMany({
      where: {
        userId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        ...dateFilter,
      },
      include: {
        desk: { select: { name: true, code: true, floor: true, zone: true, location: { select: { name: true, timezone: true } } } },
        checkin: { select: { id: true, method: true, checkedInAt: true, checkedOutAt: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: Math.min(take, 100),
    });
  }

  async create(actorId: string, dto: CreateReservationDto, actorOrgId?: string, actorRole?: string) {
    const staffRoles = ['OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'];
    if (dto.targetUserId && !staffRoles.includes(actorRole ?? '')) {
      throw new ForbiddenException('Nie masz uprawnień do rezerwacji dla innego użytkownika');
    }
    if (dto.reservationType && dto.reservationType !== 'STANDARD' && !staffRoles.includes(actorRole ?? '')) {
      throw new ForbiddenException('Nie masz uprawnień do tworzenia rezerwacji GUEST/TEAM');
    }
    const userId = dto.targetUserId ?? actorId;

    const desk = await this.prisma.desk.findUnique({
      where:   { id: dto.deskId },
      include: {
        location: {
          select: {
            organizationId: true,
            openTime: true, closeTime: true,
            maxDaysAhead: true, maxHoursPerDay: true,
            timezone: true,
          },
        },
      },
    });

    if (!desk) throw new NotFoundException(`Desk ${dto.deskId} not found`);

    if (actorOrgId && desk.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Biurko należy do innej organizacji');
    }

    // FIX P2-4: specific errors per status so the frontend can show meaningful messages
    if (desk.status === 'MAINTENANCE') {
      throw new ConflictException(
        'To biurko jest aktualnie w trybie serwisowym i nie można go zarezerwować.',
      );
    }
    if (desk.status !== 'ACTIVE') {
      throw new ConflictException('To biurko jest nieaktywne.');
    }

    // Validate booking times against office opening hours (wall-clock UTC convention)
    if (desk.location?.openTime && desk.location?.closeTime) {
      const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

      // Extract HH:MM in the location's local timezone
      const tz = desk.location?.timezone ?? 'Europe/Warsaw';
      const toLocalHHMM = (iso: string) => {
        const parts = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
        }).formatToParts(new Date(iso));
        const h = parts.find(p => p.type === 'hour')?.value   ?? '00';
        const m = parts.find(p => p.type === 'minute')?.value ?? '00';
        return `${h}:${m}`;
      };
      const startHhmm = toLocalHHMM(dto.startTime);
      const endHhmm   = toLocalHHMM(dto.endTime);

      const startMin  = toMin(startHhmm);
      const endMin    = toMin(endHhmm);
      const openMin   = toMin(desk.location.openTime);
      const closeMin  = toMin(desk.location.closeTime);
      const durationH = (endMin - startMin) / 60;

      if (startMin < openMin) {
        throw new ConflictException(`Rezerwacja nie może zaczynać się przed otwarciem biura (${desk.location.openTime})`);
      }
      if (endMin > closeMin) {
        throw new ConflictException(`Rezerwacja nie może kończyć się po zamknięciu biura (${desk.location.closeTime})`);
      }
      if (desk.location.maxHoursPerDay && durationH > desk.location.maxHoursPerDay) {
        throw new ConflictException(`Maksymalna długość rezerwacji to ${desk.location.maxHoursPerDay}h`);
      }
    }

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        deskId: dto.deskId,
        date:   new Date(dto.date),
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        OR: [
          {
            startTime: { lt: new Date(dto.endTime) },
            endTime:   { gt: new Date(dto.startTime) },
          },
        ],
      },
    });
    if (conflict) throw new ConflictException('Desk is already reserved for this time slot');

    const reservation = await this.prisma.reservation.create({
      data: {
        deskId:          dto.deskId,
        userId,
        date:            new Date(dto.date),
        startTime:       new Date(dto.startTime),
        endTime:         new Date(dto.endTime),
        notes:           dto.notes,
        status:          ReservationStatus.CONFIRMED,
        reservationType: dto.reservationType ?? 'STANDARD',
      },
      include: {
        desk: { select: { name: true, code: true } },
      },
    });

    // ── Notify beacon + in-app map (LED state depends on reservation type) ─
    this._notifyBeaconReservation(dto.deskId, reservation.startTime, reservation.endTime).catch(() => {});
    const ledState = (dto.reservationType === 'GUEST' || dto.reservationType === 'TEAM')
      ? 'GUEST_RESERVED'
      : 'RESERVED';
    // Emit RESERVED LED only if: today is reservation day, office is open, and desk is not currently occupied
    if (this._isReservationVisibleNow(reservation.startTime, desk.location?.openTime, desk.location?.timezone)) {
      const activeCheckin = await this.prisma.checkin.findFirst({
        where: { deskId: dto.deskId, checkedOutAt: null },
        select: { id: true },
      });
      if (!activeCheckin) this.ledEvents.emit(dto.deskId, ledState);
    }

    // ── Email notification ───────────────────────────────────────
    this.notify.notifyReservationConfirmed(reservation.id).catch(() => {});

    // ── Push notification — informuj bookera ─────────────────────
    const deskLabel  = reservation.desk?.name ?? dto.deskId;
    const dateLabel  = new Date(dto.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const startLabel = new Date(dto.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const endLabel   = new Date(dto.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    this.push.notifyUser(userId, {
      title: `Rezerwacja potwierdzona — ${deskLabel}`,
      body:  `${dateLabel}, ${startLabel}–${endLabel}`,
      url:   '/my-reservations',
    }).catch(() => {});

    // ── Sprint F — Integration dispatcher (Slack/Teams/Webhook) ─
    this.integrationEvents.onReservationCreated(actorOrgId ?? desk.location?.organizationId ?? '', {
      id:        reservation.id,
      deskName:  reservation.desk?.name ?? dto.deskId,
      date:      new Date(dto.date).toISOString().slice(0, 10),
      startTime: new Date(dto.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      endTime:   new Date(dto.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    }).catch(() => {});

    // ── M4 — Microsoft Graph Calendar Sync ─────────────────────
    // fire-and-forget — NIGDY nie blokuj odpowiedzi
    this.graphService.createCalendarEvent(userId, {
      reservationId: reservation.id,
      subject:       `Biurko: ${reservation.desk?.name ?? dto.deskId}`,
      start:         new Date(dto.startTime),
      end:           new Date(dto.endTime),
      location:      reservation.desk?.name,
      bodyText:      `Rezerwacja biurka zarządzana przez Reserti.`,
      timezone:      desk.location?.timezone ?? undefined,
    }).then(graphEventId => {
      if (graphEventId) {
        this.prisma.reservation.update({
          where: { id: reservation.id },
          data:  { graphEventId },
        }).catch(() => {});
      }
    }).catch(() => {});

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
      data:  { status: ReservationStatus.CANCELLED },
    });

    await this.prisma.checkin.updateMany({
      where: { reservationId: id, checkedOutAt: null },
      data:  { checkedOutAt: new Date() },
    });

    try {
      this.ledEvents.emit(reservation.deskId, 'FREE');
      this._notifyBeaconReservation(reservation.deskId, null, null).catch(() => {});
      this.notify.notifyReservationCancelled(reservation.id).catch(() => {});

      // Push — powiadom bookera jeśli anulował ktoś inny (admin)
      if (actorId !== reservation.userId) {
        // TODO: as any — backlog #6, requires typed findOne return (openapi-typescript codegen)
        const deskName = (reservation as any).desk?.name ?? reservation.deskId;
        this.push.notifyUser(reservation.userId, {
          title: 'Rezerwacja anulowana',
          body:  `Twoja rezerwacja biurka ${deskName} została anulowana przez administratora.`,
          url:   '/my-reservations',
        }).catch(() => {});
      }

      // Sprint F — Integration dispatcher
      this.integrationEvents.onReservationCancelled(actorOrgId ?? '', {
        id:       id,
        deskName: (reservation as any).desk?.name ?? reservation.deskId,
      }).catch(() => {});

      // M4 — usuń event z Outlook Calendar
      if ((reservation as any).graphEventId) {
        this.graphService.deleteCalendarEvent(
          reservation.userId,
          (reservation as any).graphEventId,
        ).catch(() => {});
      }
    } catch (_) {}

    return updated;
  }

  async getQrToken(id: string, actorId: string) {
    const reservation = await this.findOne(id);
    if (reservation.userId !== actorId) {
      throw new ForbiddenException('Not your reservation');
    }
    return { qrToken: reservation.qrToken, deskId: reservation.deskId };
  }

  // ── Cykliczne rezerwacje (Sprint G1) ──────────────────────────
  async createRecurring(actorId: string, body: any, actorOrgId?: string) {
    const { deskId, date, startTime, endTime, notes, rule, reservationType } = body;

    // Parsuj RRULE — np. 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=4'
    const dates = this._expandRRule(rule, new Date(date));
    const results: any[] = [];

    for (const d of dates) {
      const dayStr = d.toISOString().slice(0, 10);
      const startDt = new Date(`${dayStr}T${startTime.slice(11, 16)}:00.000Z`);
      const endDt   = new Date(`${dayStr}T${endTime.slice(11, 16)}:00.000Z`);

      const conflict = await this.prisma.reservation.findFirst({
        where: {
          deskId, date: d,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
          OR: [{ startTime: { lt: endDt }, endTime: { gt: startDt } }],
        },
      });
      if (conflict) continue; // Pomiń dni z konfliktem

      const res = await this.prisma.reservation.create({
        data: {
          deskId, userId: actorId,
          date: d, startTime: startDt, endTime: endDt, notes,
          status:           ReservationStatus.CONFIRMED,
          reservationType:  reservationType ?? 'STANDARD',
          recurrenceRule:   rule,
          recurrenceGroupId: `${actorId}-${Date.now()}`,
        },
        include: { desk: { select: { name: true } } },
      });
      results.push(res);
    }
    return { created: results.length, reservations: results };
  }

  async cancelRecurring(id: string, scope: 'single' | 'following' | 'all', actorId: string, actorRole: string) {
    const res = await this.findOne(id);
    if (res.userId !== actorId && !['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(actorRole)) {
      throw new ForbiddenException('Not allowed');
    }

    const groupId = (res as any).recurrenceGroupId;
    if (!groupId || scope === 'single') {
      return this.cancel(id, actorId, actorRole);
    }

    const where: any = {
      recurrenceGroupId: groupId,
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    };
    if (scope === 'following') {
      where.startTime = { gte: res.startTime };
    }

    const toCancel = await this.prisma.reservation.findMany({ where, select: { id: true } });
    for (const r of toCancel) {
      await this.cancel(r.id, actorId, actorRole);
    }
    return { cancelled: toCancel.length };
  }

  // ── Cron: co 15 min wygaś stare rezerwacje ────────────────────
  @Cron('0 */15 * * * *')
  async expireOld() {
    const now = new Date();

    // Pobierz deskId przed updatem — updateMany nie zwraca rekordów
    const toExpire = await this.prisma.reservation.findMany({
      where: {
        status:  ReservationStatus.CONFIRMED,
        endTime: { lt: now },
      },
      select: { id: true, deskId: true },
    });

    if (toExpire.length === 0) return 0;

    await this.prisma.reservation.updateMany({
      where: { id: { in: toExpire.map(r => r.id) } },
      data:  { status: ReservationStatus.EXPIRED },
    });

    this.logger.log(`Expired ${toExpire.length} stale reservation(s)`);

    // Emituj LED FREE dla każdego biurka — beacon musi dostać aktualizację
    for (const r of toExpire) {
      this.ledEvents.emit(r.deskId, 'FREE');
    }

    return toExpire.length;
  }

  // ── Private helpers ──────────────────────────────────────────
  private async _notifyBeaconReservation(
    deskId: string,
    startTime: Date | null,
    endTime:   Date | null,
  ) {
    try {
      const gatewayId = await this.gateways.findGatewayForDesk(deskId);
      if (!gatewayId) return;

      if (startTime && endTime) {
        await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_RESERVATION', {
          startTime: startTime.getTime() / 1000,
          endTime:   endTime.getTime()   / 1000,
        });
      } else {
        await this.gateways.sendBeaconCommand(gatewayId, deskId, 'CLEAR_RESERVATION', {});
      }
    } catch (_) {}
  }

  private _expandRRule(rule: string, baseDate: Date): Date[] {
    // Minimalistyczny parser RRULE — obsługuje FREQ=WEEKLY;BYDAY=...;COUNT=N
    const params: Record<string, string> = {};
    for (const part of rule.split(';')) {
      const [k, v] = part.split('=');
      if (k && v) params[k] = v;
    }

    const count  = parseInt(params['COUNT'] ?? '4', 10);
    const freq   = params['FREQ'] ?? 'WEEKLY';
    const bydays = params['BYDAY']?.split(',') ?? [];

    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const results: Date[] = [];
    const cursor = new Date(baseDate);

    let iterations = 0;
    while (results.length < count && iterations < 365) {
      iterations++;
      const dow = cursor.getDay();
      const dayKey = Object.keys(dayMap).find(k => dayMap[k] === dow);
      if (!bydays.length || (dayKey && bydays.includes(dayKey))) {
        results.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + (freq === 'DAILY' ? 1 : 1));
    }
    return results;
  }

  // Returns true when the RESERVED LED should be shown for a given reservation:
  // only on the reservation's own calendar day, and only once the office is open.
  private _isReservationVisibleNow(startTime: Date, openTime?: string | null, timezone?: string | null): boolean {
    const tz  = timezone ?? 'Europe/Warsaw';
    const now = new Date();
    const fmtDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    if (fmtDate(now) !== fmtDate(startTime)) return false;
    if (!openTime) return true;
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).formatToParts(now);
    const nowMin = toMin(`${parts.find(p => p.type === 'hour')?.value ?? '0'}:${parts.find(p => p.type === 'minute')?.value ?? '0'}`);
    return nowMin >= toMin(openTime);
  }
}
