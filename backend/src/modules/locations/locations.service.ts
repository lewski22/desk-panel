import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService }    from '../../database/prisma.service';
import { WifiCryptoService } from '../crypto/wifi-crypto.service';

export interface CreateLocationDto {
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  timezone?: string;
  openTime?: string;            // HH:mm, e.g. "08:00"
  closeTime?: string;           // HH:mm, e.g. "17:00"
  maxDaysAhead?: number;        // Max dni do przodu przy rezerwacji (default: 14)
  maxHoursPerDay?: number;      // Max długość jednej rezerwacji w godzinach (default: 8)
  parkingBookingMode?: string;  // "HOURLY" | "ALL_DAY" (default: "HOURLY")
  wifiSsid?: string;            // plaintext — encrypted before storing
  wifiPass?: string;            // plaintext — encrypted before storing
}

@Injectable()
export class LocationsService {
  constructor(
    private prisma:      PrismaService,
    private wifiCrypto:  WifiCryptoService,
  ) {}

  async findAll(organizationId?: string) {
    const rows = await this.prisma.location.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        _count:       { select: { desks: true, gateways: true } },
        organization: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ wifiSsidEnc, wifiPassEnc, ...loc }) => ({
      ...loc,
      hasWifi: !!wifiSsidEnc,
    }));
  }

  async findOne(id: string) {
    const raw = await this.prisma.location.findUnique({
      where: { id },
      include: {
        desks:    { orderBy: [{ floor: 'asc' }, { code: 'asc' }] },
        gateways: true,
        organization: { select: { name: true } },
      },
    });
    if (!raw) throw new NotFoundException(`Location ${id} not found`);
    const { wifiSsidEnc, wifiPassEnc, ...loc } = raw;
    return { ...loc, hasWifi: !!wifiSsidEnc };
  }

  async create(dto: CreateLocationDto) {
    return this.prisma.location.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateLocationDto> & { isActive?: boolean; kioskPin?: string | null }) {
    const { wifiSsid, wifiPass, ...rest } = dto as any;

    const wifiData: Record<string, string | null> = {};
    if (wifiSsid !== undefined) {
      wifiData.wifiSsidEnc = wifiSsid ? this.wifiCrypto.encrypt(wifiSsid) : null;
    }
    if (wifiPass !== undefined) {
      wifiData.wifiPassEnc = wifiPass ? this.wifiCrypto.encrypt(wifiPass) : null;
    }

    return this.prisma.location.update({ where: { id }, data: { ...rest, ...wifiData } });
  }

  async getWifiCredentials(id: string): Promise<{ wifiSsid: string | null; wifiPass: string | null }> {
    const loc = await this.prisma.location.findUnique({
      where:  { id },
      select: { wifiSsidEnc: true, wifiPassEnc: true },
    });
    if (!loc) throw new NotFoundException(`Location ${id} not found`);

    return {
      wifiSsid: loc.wifiSsidEnc ? this.wifiCrypto.decrypt(loc.wifiSsidEnc) : null,
      wifiPass: loc.wifiPassEnc ? this.wifiCrypto.decrypt(loc.wifiPassEnc) : null,
    };
  }

  async verifyKioskPin(locationId: string, pin: string): Promise<{ ok: boolean }> {
    const loc = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { kioskPin: true },
    });
    if (!loc) return { ok: false };
    // kioskPin null/empty → PIN not configured, reject
    if (!loc.kioskPin) return { ok: false };
    return { ok: loc.kioskPin === pin };
  }

  async getOccupancyAnalytics(locationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // FIX: use parallel count queries instead of loading all desk rows
    const [total, occupied, todayCheckins, reservationsToday] = await Promise.all([
      this.prisma.desk.count({ where: { locationId, status: 'ACTIVE' } }),
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedOutAt: null },
      }),
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: today } },
      }),
      this.prisma.reservation.count({
        where: {
          desk:   { locationId },
          date:   today,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      }),
    ]);

    return {
      totalDesks:        total,
      occupiedDesks:     occupied,
      occupancyPct:      total > 0 ? Math.round((occupied / total) * 100) : 0,
      todayCheckins,
      reservationsToday,
    };
  }

  async getAnalyticsExtended(locationId: string) {
    const now    = new Date();
    const today  = new Date(now); today.setHours(0, 0, 0, 0);
    const days30 = new Date(today); days30.setDate(days30.getDate() - 30);
    const days7  = new Date(today); days7.setDate(days7.getDate() - 6);
    const lastWeekStart = new Date(today); lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const lastWeekEnd   = new Date(today); lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // FIX: one query for 30 days, all aggregations done in JS — avoids 7 round-trips
    const [recentCheckins, topDesks, methods, thisWeekCount, lastWeekCount] = await Promise.all([
      // All check-ins from last 30 days — used for hourly + weekly breakdown
      this.prisma.checkin.findMany({
        where: { desk: { locationId }, checkedInAt: { gte: days30 } },
        select: { checkedInAt: true },
      }),
      // Top 5 desks by check-in count
      this.prisma.desk.findMany({
        where:   { locationId, status: 'ACTIVE' },
        include: { _count: { select: { checkins: true, reservations: true } } },
        orderBy: { checkins: { _count: 'desc' } },
        take:    5,
      }),
      // Check-in method breakdown
      this.prisma.checkin.groupBy({
        by:    ['method'],
        where: { desk: { locationId }, checkedInAt: { gte: days30 } },
        _count: true,
      }),
      // This week count
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: lastWeekEnd, lt: now } },
      }),
      // Last week count
      this.prisma.checkin.count({
        where: { desk: { locationId }, checkedInAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      }),
    ]);

    // Build 7-day chart from in-memory data (no extra queries)
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const day  = new Date(days7); day.setDate(day.getDate() + i);
      const next = new Date(day);   next.setDate(next.getDate() + 1);
      return {
        day:      day.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' }),
        checkins: recentCheckins.filter(c => c.checkedInAt >= day && c.checkedInAt < next).length,
      };
    });

    // Hourly distribution from same dataset
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour:  `${String(h).padStart(2, '0')}:00`,
      count: recentCheckins.filter(c => c.checkedInAt.getHours() === h).length,
    }));

    const weekTrend = lastWeekCount > 0
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      : 0;

    return { weekData, hourly, topDesks, weekTrend, thisWeekCount, lastWeekCount, methods };
  }

  /** Sprint A1 — "Today's Issues" widget na dashboardzie */
  async getTodayIssues(locationId: string) {
    const now   = new Date();
    const ago30 = new Date(now.getTime() - 30  * 60 * 1000);  // 30 min
    const ago3h = new Date(now.getTime() - 3   * 60 * 60 * 1000);  // 3h
    const ago10 = new Date(now.getTime() - 10  * 60 * 1000);  // 10 min gateway offline

    const [beaconsOffline, longCheckins, otaFailed, noCheckins] = await Promise.all([
      // Beacony offline > 30min (isOnline=true ale lastSeen stale)
      this.prisma.device.findMany({
        where: {
          desk: { locationId },
          isOnline: true,
          lastSeen: { lt: ago30 },
        },
        select: { id: true, hardwareId: true, desk: { select: { id: true, name: true, code: true } } },
        take: 10,
      }),
      // Biurka OCCUPIED > 3h bez check-out
      this.prisma.checkin.findMany({
        where: {
          desk:         { locationId },
          checkedOutAt: null,
          checkedInAt:  { lt: ago3h },
        },
        select: {
          id:          true,
          checkedInAt: true,
          desk:        { select: { id: true, name: true, code: true } },
          user:        { select: { firstName: true, lastName: true } },
        },
        take: 10,
      }),
      // Beacony z failed OTA
      this.prisma.device.findMany({
        where: {
          desk: { locationId },
          otaStatus: 'failed',
        },
        select: { id: true, hardwareId: true, firmwareVersion: true, desk: { select: { id: true, name: true } } },
        take: 10,
      }),
      // Rezerwacje bez check-in > 30min po startTime (tylko dziś)
      this.prisma.reservation.findMany({
        where: {
          desk:      { locationId },
          status:    'CONFIRMED',
          startTime: { lt: ago30, gte: new Date(now.setHours(0,0,0,0)) },
          checkedInAt: null,
        },
        select: {
          id:        true,
          startTime: true,
          desk:      { select: { id: true, name: true, code: true } },
          user:      { select: { firstName: true, lastName: true } },
        },
        take: 10,
      }),
    ]);

    return {
      beaconsOffline: beaconsOffline.map(d => ({
        type:    'BEACON_OFFLINE' as const,
        id:      d.id,
        label:   d.desk?.name ?? d.hardwareId,
        deskId:  d.desk?.id,
        detail:  d.hardwareId,
        navTo:   '/provisioning',
      })),
      longCheckins: longCheckins.map(c => ({
        type:    'LONG_CHECKIN' as const,
        id:      c.id,
        label:   c.desk?.name ?? '—',
        deskId:  c.desk?.id,
        detail:  `${c.user?.firstName ?? ''} ${c.user?.lastName ?? ''}`.trim(),
        since:   c.checkedInAt,
        navTo:   '/reservations',
      })),
      otaFailed: otaFailed.map(d => ({
        type:    'OTA_FAILED' as const,
        id:      d.id,
        label:   d.desk?.name ?? d.hardwareId,
        deskId:  d.desk?.id,
        detail:  d.firmwareVersion ?? '',
        navTo:   '/provisioning',
      })),
      noCheckins: noCheckins.map(r => ({
        type:    'NO_CHECKIN' as const,
        id:      r.id,
        label:   r.desk?.name ?? '—',
        deskId:  r.desk?.id,
        detail:  `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
        since:   r.startTime,
        navTo:   '/reservations',
      })),
      total: beaconsOffline.length + longCheckins.length + otaFailed.length + noCheckins.length,
    };
  }


  // ── Sprint D / Multi-floor: Floor Plan ───────────────────────

  async getFloors(locationId: string): Promise<string[]> {
    const plans = await this.prisma.locationFloorPlan.findMany({
      where:   { locationId },
      select:  { floor: true },
      orderBy: { floor: 'asc' },
    });
    return plans.map(p => p.floor);
  }

  async getFloorPlan(locationId: string, floor?: string) {
    if (floor) {
      const fp = await this.prisma.locationFloorPlan.findUnique({
        where:  { locationId_floor: { locationId, floor } },
        select: { floorPlanUrl: true, floorPlanW: true, floorPlanH: true, gridSize: true },
      });
      return fp ?? { floorPlanUrl: null, floorPlanW: null, floorPlanH: null, gridSize: 40 };
    }
    // Backward compat — single floor plan on Location
    const loc = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { floorPlanUrl: true, floorPlanW: true, floorPlanH: true, gridSize: true },
    });
    if (!loc) throw new Error('Location not found');
    return loc;
  }

  async uploadFloorPlan(
    locationId: string,
    data: { floorPlanUrl: string; floorPlanW?: number; floorPlanH?: number; gridSize?: number },
    floor?: string,
  ) {
    if (data.floorPlanUrl && data.floorPlanUrl.length > 3_000_000) {
      throw new Error('Plik jest za duży (max 2MB)');
    }
    if (floor) {
      return this.prisma.locationFloorPlan.upsert({
        where:  { locationId_floor: { locationId, floor } },
        create: { locationId, floor, floorPlanUrl: data.floorPlanUrl, floorPlanW: data.floorPlanW, floorPlanH: data.floorPlanH, gridSize: data.gridSize },
        update: { floorPlanUrl: data.floorPlanUrl, ...(data.floorPlanW && { floorPlanW: data.floorPlanW }), ...(data.floorPlanH && { floorPlanH: data.floorPlanH }), ...(data.gridSize && { gridSize: data.gridSize }) },
        select: { id: true, floor: true, floorPlanUrl: true, floorPlanW: true, floorPlanH: true, gridSize: true },
      });
    }
    return this.prisma.location.update({
      where: { id: locationId },
      data: {
        floorPlanUrl: data.floorPlanUrl,
        ...(data.floorPlanW && { floorPlanW: data.floorPlanW }),
        ...(data.floorPlanH && { floorPlanH: data.floorPlanH }),
        ...(data.gridSize   && { gridSize:   data.gridSize }),
      },
      select: { id: true, floorPlanUrl: true, floorPlanW: true, floorPlanH: true, gridSize: true },
    });
  }

  async deleteFloorPlan(locationId: string, floor?: string) {
    if (floor) {
      await this.prisma.locationFloorPlan.deleteMany({
        where: { locationId, floor },
      });
      return { id: locationId, floor };
    }
    return this.prisma.location.update({
      where: { id: locationId },
      data:  { floorPlanUrl: null, floorPlanW: null, floorPlanH: null },
      select: { id: true },
    });
  }


  // ── Sprint E1: Weekly attendance — kto kiedy w biurze ────────
  // Tygodniowe zestawienie obecności per user × dzień
  // Agreguje z Checkin (faktyczna obecność) i Reservation (planowana)
  async getAttendance(locationId: string, weekParam: string) {
    // Parsuj tydzień — format: '2026-W20' lub 'YYYY-Www'
    const weekMatch = weekParam.match(/^(\d{4})-W(\d{1,2})$/);
    let monday: Date;
    if (weekMatch) {
      const [, year, week] = weekMatch;
      // ISO week: tygodnie liczone od poniedziałku
      monday = this._isoWeekToDate(parseInt(year), parseInt(week));
    } else {
      // fallback: bieżący tydzień
      monday = this._currentMonday();
    }

    // Dni: Pon–Pt (5 dni)
    const days: Date[] = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });

    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    // Pobierz użytkowników org tej lokalizacji
    const location = await this.prisma.location.findUnique({
      where:  { id: locationId },
      select: { organizationId: true },
    });
    if (!location) throw new Error('Location not found');

    const [users, checkins, reservations] = await Promise.all([
      // Aktywni użytkownicy tej org (limit 50 — weekly view UI)
      this.prisma.user.findMany({
        where: {
          organizationId: location.organizationId,
          isActive:       true,
          role:           { in: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
        },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 50,
      }),
      // Check-iny z tego tygodnia w tej lokalizacji
      this.prisma.checkin.findMany({
        where: {
          desk:        { locationId },
          checkedInAt: { gte: monday, lte: friday },
        },
        select: { userId: true, checkedInAt: true, checkedOutAt: true },
      }),
      // Rezerwacje z tego tygodnia w tej lokalizacji
      this.prisma.reservation.findMany({
        where: {
          desk:   { locationId },
          status: { in: ['CONFIRMED','COMPLETED'] },
          date:   { gte: monday, lte: friday },
        },
        select: { userId: true, date: true, status: true },
      }),
    ]);

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    // Zbuduj mapę userId → date → status
    const presenceMap = new Map<string, Map<string, string>>();

    for (const c of checkins) {
      const dateStr = toDateStr(c.checkedInAt);
      if (!presenceMap.has(c.userId)) presenceMap.set(c.userId, new Map());
      presenceMap.get(c.userId)!.set(dateStr, 'office');
    }
    for (const r of reservations) {
      const dateStr = toDateStr(new Date(r.date));
      if (!presenceMap.has(r.userId)) presenceMap.set(r.userId, new Map());
      if (!presenceMap.get(r.userId)!.has(dateStr)) {
        presenceMap.get(r.userId)!.set(dateStr, 'reserved');
      }
    }

    const rows = users.map(u => ({
      user:    { id: u.id, firstName: u.firstName ?? '', lastName: u.lastName ?? '', role: u.role },
      days:    days.map(d => ({
        date:   toDateStr(d),
        status: presenceMap.get(u.id)?.get(toDateStr(d)) ?? 'unknown',
      })),
    }));

    return {
      week:  weekParam,
      monday: toDateStr(monday),
      days:   days.map(d => ({ date: toDateStr(d), label: d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }) })),
      rows,
    };
  }

  private _currentMonday(): Date {
    const d   = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon…
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private _isoWeekToDate(year: number, week: number): Date {
    // Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const startOfW1 = new Date(jan4);
    startOfW1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const target = new Date(startOfW1);
    target.setDate(startOfW1.getDate() + (week - 1) * 7);
    target.setHours(0, 0, 0, 0);
    return target;
  }

}