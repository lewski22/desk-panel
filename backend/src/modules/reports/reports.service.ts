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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Heatmap: check-ins pogrupowane po dniu tygodnia × godzinie ──
  async getHeatmap(orgId: string, from: Date, to: Date, locationId?: string): Promise<HeatmapCell[]> {
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

    // Buduj mapę [day][hour] → count
    const map = new Map<string, number>();
    for (const ci of checkins) {
      if (!ci.checkedInAt) continue;
      const d = ci.checkedInAt;
      // getDay() → 0=Sun…6=Sat, normalizuj do 0=Mon…6=Sun
      const day  = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      const key  = `${day}:${hour}`;
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
      const durMs = ci.checkedInAt && ci.checkedOutAt
        ? ci.checkedOutAt.getTime() - ci.checkedInAt.getTime()
        : null;

      return {
        date:           ci.checkedInAt?.toISOString().slice(0, 10) ?? '',
        locationId:     loc?.id ?? '',
        locationName:   loc?.name ?? '',
        deskId:         desk?.id ?? '',
        deskLabel:      desk?.name ?? '',
        checkinMethod:  ci.method ?? null,
        checkedInAt:    ci.checkedInAt?.toISOString() ?? null,
        checkedOutAt:   ci.checkedOutAt?.toISOString() ?? null,
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

  // ── Utils ────────────────────────────────────────────────────────
  private escapeCsv(val: string): string {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  validateDateRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
    const fromDate = new Date(from);
    const toDate   = new Date(to);
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
