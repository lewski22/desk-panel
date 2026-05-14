/**
 * ReportsService — analityka i raporty zajętości biurek.
 *
 * Generuje raporty dla adminów i exporty danych:
 * - Heatmap zajętości (dzień × godzina) — pomaga zidentyfikować szczyty
 * - Dzienne wskaźniki zajętości per lokalizacja i biurko
 * - Ranking najczęściej używanych biurek
 * - Eksport do XLSX (biblioteka xlsx) z uwzględnieniem dni wolnych (date-holidays)
 * - Filtrowanie po lokalizacji, zakresie dat i typie rezerwacji
 *
 * Wszystkie zapytania są org-scoped: OFFICE_ADMIN widzi tylko swoją org,
 * SUPER_ADMIN może przekazać dowolne organizationId.
 *
 * backend/src/modules/reports/reports.service.ts
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService }                    from '../../database/prisma.service';
import { ExportReportDto }                  from './dto/export-report.dto';
import Holidays                             from 'date-holidays';

export interface HeatmapCell {
  day:   number; // 0=Mon … 6=Sun
  hour:  number; // 0-23
  count: number;
}

export interface OccupancyRow {
  date:           string;
  locationId:     string;
  locationName:   string;
  deskId:         string;
  deskLabel:      string;
  checkinMethod:  string | null;
  checkedInAt:    string | null;
  checkedOutAt:   string | null;
  durationMin:    number | null;
  reservationId:  string | null;
  userId:         string | null;
  userEmail:      string | null;
}

export interface ReservationsByDayRow { date: string; count: number }
export interface ReservationsByMethodRow { method: string; count: number }
export interface ReservationsByUserRow {
  userId: string; email: string;
  firstName: string | null; lastName: string | null;
  count: number;
}
export interface ReservationsByDeskRow {
  deskId: string; name: string; locationName: string; count: number;
}

// Weekday order: 0=Mon … 6=Sun (ISO)
const WEEKDAY_IDX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function toLocalDayHour(d: Date, tz: string): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    hour:    'numeric',
    hour12:  false,
    hourCycle: 'h23',
  }).formatToParts(d);

  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Monday';
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';
  const hour    = parseInt(hourStr, 10);

  return { day: WEEKDAY_IDX[weekday] ?? 0, hour: isNaN(hour) ? 0 : hour % 24 };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Heatmap: check-ins pogrupowane po dniu tygodnia × godzinie ──
  async getHeatmap(orgId: string, from: Date, to: Date, locationId?: string): Promise<HeatmapCell[]> {
    // Pobierz timezone biura — godziny muszą być w lokalnej strefie, nie UTC
    const tzRow = locationId
      ? await this.prisma.location.findUnique({ where: { id: locationId }, select: { timezone: true } })
      : await this.prisma.location.findFirst({ where: { organizationId: orgId }, select: { timezone: true } });
    const tz = tzRow?.timezone ?? 'Europe/Warsaw';

    const checkins = await this.prisma.checkin.findMany({
      where: {
        reservation: {
          desk: {
            location: {
              organizationId: orgId,
              ...(locationId ? { id: locationId } : {}),
            },
          },
        },
        checkedInAt: { gte: from, lte: to },
      },
      select: { checkedInAt: true },
    });

    // Buduj mapę [day][hour] → count (w lokalnej strefie czasowej)
    const map = new Map<string, number>();
    for (const ci of checkins) {
      if (!ci.checkedInAt) continue;
      const { day, hour } = toLocalDayHour(ci.checkedInAt, tz);
      const key = `${day}:${hour}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    // Wypełnij wszystkie komórki (7 × 24)
    const result: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        result.push({ day, hour, count: map.get(`${day}:${hour}`) ?? 0 });
      }
    }
    return result;
  }

  // ── Dane do eksportu: szczegółowe wiersze check-in/out ──────────
  async getOccupancyRows(
    orgId: string,
    from:  Date,
    to:    Date,
    locationId?: string,
  ): Promise<OccupancyRow[]> {
    const checkins = await this.prisma.checkin.findMany({
      where: {
        reservation: {
          desk: {
            location: {
              organizationId: orgId,
              ...(locationId ? { id: locationId } : {}),
            },
          },
        },
        checkedInAt: { gte: from, lte: to },
      },
      include: {
        reservation: {
          include: {
            desk:     { include: { location: true } },
            user:     { select: { id: true, email: true } },
          },
        },
      },
      orderBy: { checkedInAt: 'asc' },
    });

    return checkins.map(ci => {
      const res  = ci.reservation;
      const desk = res?.desk;
      const loc  = desk?.location;
      const tz   = loc?.timezone ?? 'Europe/Warsaw';
      const durMs = ci.checkedInAt && ci.checkedOutAt
        ? ci.checkedOutAt.getTime() - ci.checkedInAt.getTime()
        : null;

      const toLocal = (d: Date | null): string | null => {
        if (!d) return null;
        return new Intl.DateTimeFormat('sv-SE', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).format(d).replace(' ', 'T');
      };

      return {
        date:           ci.checkedInAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ci.checkedInAt) : '',
        locationId:     loc?.id ?? '',
        locationName:   loc?.name ?? '',
        deskId:         desk?.id ?? '',
        deskLabel:      desk?.name ?? '',
        checkinMethod:  ci.method ?? null,
        checkedInAt:    toLocal(ci.checkedInAt),
        checkedOutAt:   toLocal(ci.checkedOutAt),
        durationMin:    durMs !== null ? Math.round(durMs / 60000) : null,
        reservationId:  res?.id ?? null,
        userId:         res?.user?.id ?? null,
        userEmail:      res?.user?.email ?? null,
      };
    });
  }

  // ── CSV ─────────────────────────────────────────────────────────
  rowsToCsv(rows: OccupancyRow[]): Buffer {
    const header = [
      'date', 'locationId', 'locationName', 'deskId', 'deskLabel',
      'checkinMethod', 'checkedInAt', 'checkedOutAt', 'durationMin',
      'reservationId', 'userId', 'userEmail',
    ].join(',');

    const lines = rows.map(r =>
      [
        r.date, r.locationId, this.escapeCsv(r.locationName),
        r.deskId, this.escapeCsv(r.deskLabel),
        r.checkinMethod ?? '',
        r.checkedInAt   ?? '',
        r.checkedOutAt  ?? '',
        r.durationMin   ?? '',
        r.reservationId ?? '',
        r.userId        ?? '',
        r.userEmail     ?? '',
      ].join(','),
    );

    return Buffer.from([header, ...lines].join('\n'), 'utf-8');
  }

  // ── XLSX ────────────────────────────────────────────────────────
  async rowsToXlsx(rows: OccupancyRow[]): Promise<Buffer> {
    // Dynamiczny import — xlsx jest opcjonalną zależnością
    let xlsx: any;
    try {
      xlsx = await import('xlsx').catch(() => null);
    } catch {
      throw new BadRequestException(
        'xlsx package not installed. Run: npm install xlsx --save',
      );
    }

    const wsData = [
      [
        'Date', 'Location ID', 'Location', 'Desk ID', 'Desk',
        'Check-in method', 'Checked in at', 'Checked out at',
        'Duration (min)', 'Reservation ID', 'User ID', 'Email',
      ],
      ...rows.map(r => [
        r.date, r.locationId, r.locationName, r.deskId, r.deskLabel,
        r.checkinMethod, r.checkedInAt, r.checkedOutAt,
        r.durationMin, r.reservationId, r.userId, r.userEmail,
      ]),
    ];

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Occupancy');
    return Buffer.from(xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Rezerwacje per dzień ─────────────────────────────────────────
  async getReservationsByDay(
    orgId: string, from: Date, to: Date, locationId?: string,
  ): Promise<ReservationsByDayRow[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { location: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) } },
        date: { gte: from, lte: to },
      },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    const map = new Map<string, number>();
    for (const r of reservations) {
      const key = r.date.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }

  // ── Rezerwacje per metoda ────────────────────────────────────────
  async getReservationsByMethod(
    orgId: string, from: Date, to: Date, locationId?: string,
  ): Promise<ReservationsByMethodRow[]> {
    const checkins = await this.prisma.checkin.findMany({
      where: {
        reservation: {
          desk: { location: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) } },
          date: { gte: from, lte: to },
        },
      },
      select: { method: true },
    });

    const map = new Map<string, number>();
    for (const ci of checkins) {
      const key = ci.method ?? 'UNKNOWN';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Rezerwacje per użytkownik ────────────────────────────────────
  async getReservationsByUser(
    orgId: string, from: Date, to: Date, locationId?: string,
  ): Promise<ReservationsByUserRow[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { location: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) } },
        date: { gte: from, lte: to },
      },
      select: {
        userId: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    const map = new Map<string, ReservationsByUserRow>();
    for (const r of reservations) {
      if (!r.userId) continue;
      if (!map.has(r.userId)) {
        map.set(r.userId, {
          userId:    r.userId,
          email:     r.user?.email ?? '',
          firstName: r.user?.firstName ?? null,
          lastName:  r.user?.lastName  ?? null,
          count:     0,
        });
      }
      map.get(r.userId)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // ── Rezerwacje per biurko ────────────────────────────────────────
  async getReservationsByDesk(
    orgId: string, from: Date, to: Date, locationId?: string,
  ): Promise<ReservationsByDeskRow[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { location: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) } },
        date: { gte: from, lte: to },
      },
      select: {
        deskId: true,
        desk: { select: { name: true, location: { select: { name: true } } } },
      },
    });

    const map = new Map<string, ReservationsByDeskRow>();
    for (const r of reservations) {
      if (!map.has(r.deskId)) {
        map.set(r.deskId, {
          deskId:       r.deskId,
          name:         r.desk?.name ?? '',
          locationName: r.desk?.location?.name ?? '',
          count:        0,
        });
      }
      map.get(r.deskId)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // ── Dashboard Snapshot: KPI bieżącego dnia per lokalizacja ─────
  async getDashboardSnapshot(orgId: string, locationId?: string) {
    const locations = await this.prisma.location.findMany({
      where: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) },
      select: { id: true, name: true, timezone: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(locations.map(async loc => {
      const tz    = loc.timezone ?? 'Europe/Warsaw';
      const todayLocal = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
      const today = new Date(todayLocal);  // midnight in UTC, adjusted for tz

      const [totalDesks, occupiedNow, checkinsToday, reservationsToday, zoneRows] =
        await Promise.all([
          this.prisma.desk.count({ where: { locationId: loc.id, status: 'ACTIVE' } }),
          this.prisma.checkin.count({ where: { desk: { locationId: loc.id }, checkedOutAt: null } }),
          this.prisma.checkin.count({
            where: { desk: { locationId: loc.id }, checkedInAt: { gte: today } },
          }),
          this.prisma.reservation.count({
            where: {
              desk:   { locationId: loc.id },
              date:   today,
              status: { in: ['CONFIRMED', 'PENDING'] },
            },
          }),
          this.prisma.desk.groupBy({
            by:     ['zone'],
            where:  { locationId: loc.id, status: 'ACTIVE' },
            _count: { id: true },
          }),
        ]);

      // Per-zone occupied count
      const occupiedByZone = await Promise.all(
        zoneRows.map(async z => {
          const occ = await this.prisma.checkin.count({
            where: { desk: { locationId: loc.id, zone: z.zone }, checkedOutAt: null },
          });
          return { zone: z.zone ?? 'Inne', total: z._count.id, occupied: occ };
        }),
      );

      return {
        locationId:        loc.id,
        locationName:      loc.name,
        totalDesks,
        occupiedNow,
        occupancyPct:      totalDesks > 0 ? Math.round((occupiedNow / totalDesks) * 100) : 0,
        checkinsToday,
        reservationsToday,
        zones:             occupiedByZone,
      };
    }));
  }

  // ── Desk Utilization Report (P4-B2) ────────────────────────────
  async getUtilization(orgId: string, from: Date, to: Date, locationId?: string) {
    const desks = await this.prisma.desk.findMany({
      where: {
        location: { organizationId: orgId, ...(locationId ? { id: locationId } : {}) },
        status: 'ACTIVE',
      },
      select: {
        id: true, name: true, code: true, floor: true, zone: true,
        location: { select: { id: true, name: true, country: true } },
        reservations: {
          where: {
            date:   { gte: from, lte: to },
            status: { in: ['CONFIRMED', 'COMPLETED', 'EXPIRED'] },
          },
          select: { id: true },
        },
      },
    });

    // Group by location to avoid re-computing workdays per desk
    const workdaysByLoc = new Map<string, number>();
    for (const d of desks) {
      const locKey = d.location.id;
      if (!workdaysByLoc.has(locKey)) {
        workdaysByLoc.set(locKey, this._countWorkdays(from, to, d.location.country ?? undefined));
      }
    }

    return desks.map(d => {
      const workdays = workdaysByLoc.get(d.location.id) ?? 0;
      return {
        deskId:       d.id,
        deskName:     d.name,
        deskCode:     d.code,
        floor:        d.floor,
        zone:         d.zone,
        locationId:   d.location.id,
        locationName: d.location.name,
        reservations: d.reservations.length,
        workdays,
        utilizationPct: workdays > 0
          ? Math.round((d.reservations.length / workdays) * 100)
          : 0,
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
  }

  private _countWorkdays(from: Date, to: Date, country?: string): number {
    // Build holiday set for the range if country code provided
    let holidayDates: Set<string> | null = null;
    if (country) {
      try {
        const hd = new Holidays(country);
        const year = from.getFullYear();
        const toYear = to.getFullYear();
        const allHolidays: string[] = [];
        for (let y = year; y <= toYear; y++) {
          hd.getHolidays(y)
            .filter(h => h.type === 'public')
            .forEach(h => allHolidays.push(h.date.slice(0, 10)));
        }
        holidayDates = new Set(allHolidays);
      } catch {}
    }

    let count = 0;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (cursor <= end) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        const dateStr = cursor.toISOString().slice(0, 10);
        if (!holidayDates || !holidayDates.has(dateStr)) count++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  // ── Parking report ───────────────────────────────────────────────
  async getParkingReport(orgId: string, filters: {
    from: Date; to: Date; locationId?: string; resourceId?: string; noCheckinOnly?: boolean;
  }) {
    const baseWhere: any = {
      status: 'CONFIRMED',
      date:   { gte: filters.from, lte: filters.to },
      resource: {
        type:     'PARKING',
        location: { organizationId: orgId },
        ...(filters.locationId && { locationId: filters.locationId }),
        ...(filters.resourceId && { id: filters.resourceId }),
      },
    };

    const allBookings = await this.prisma.booking.findMany({
      where:   baseWhere,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        resource: {
          select: {
            id: true, name: true, code: true, floor: true, zone: true,
            qrCheckinEnabled: true,
            location: { select: { name: true, timezone: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take:    2000,
    });

    const total       = allBookings.length;
    const withCheckin = allBookings.filter(b => b.checkedInAt).length;
    const noCheckin   = allBookings.filter(
      b => !b.checkedInAt && (b.resource as any).qrCheckinEnabled && new Date(b.endTime) < new Date(),
    ).length;
    const checkinPct = total > 0 ? Math.round((withCheckin / total) * 100) : 0;

    const countByResource = allBookings.reduce((acc, b) => {
      acc[b.resourceId] = (acc[b.resourceId] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const topResourceId = Object.entries(countByResource).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topResource   = allBookings.find(b => b.resourceId === topResourceId)?.resource ?? null;

    const unconfirmed = allBookings.filter(
      b => !b.checkedInAt && (b.resource as any).qrCheckinEnabled && new Date(b.endTime) < new Date(),
    );
    const confirmed = allBookings.filter(b => !!b.checkedInAt);

    const days = this._generateDateRange(filters.from, filters.to);
    const chartData = days.map(day => {
      const dayStr      = day.toISOString().split('T')[0];
      const dayBookings = allBookings.filter(b => b.date.toISOString().split('T')[0] === dayStr);
      return {
        date:     dayStr,
        bookings: dayBookings.length,
        checkins: dayBookings.filter(b => b.checkedInAt).length,
      };
    });

    return { kpi: { total, withCheckin, noCheckin, checkinPct, topResource }, unconfirmed, confirmed, chartData };
  }

  private _generateDateRange(from: Date, to: Date): Date[] {
    const days: Date[] = [];
    const cur = new Date(from);
    while (cur <= to) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return days;
  }

  // ── Utils ────────────────────────────────────────────────────────
  private escapeCsv(val: string): string {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  validateDateRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
    const fromDate = new Date(from ?? '');
    const toDate   = new Date(to ?? '');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('"from" must be before "to"');
    }
    const diffDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (diffDays > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
    // Ustaw toDate na koniec dnia
    toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
  }
}
