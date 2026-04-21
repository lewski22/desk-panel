import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService }                    from '../../database/prisma.service';
import { ExportReportDto }                  from './dto/export-report.dto';

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
