import {
  Controller, Get, Query, Res, UseGuards,
  Request, ForbiddenException,
} from '@nestjs/common';
import { Response }          from 'express';
import { JwtAuthGuard }      from '../auth/guards/jwt-auth.guard';
import { Roles }             from '../auth/decorators/roles.decorator';
import { RolesGuard }        from '../auth/guards/roles.guard';
import { ReportsService }    from './reports.service';
import { ExportReportDto }   from './dto/export-report.dto';

const REPORT_ROLES        = ['OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'] as const;
const REPORT_EXPORT_ROLES = ['OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN'] as const;

/**
 * ReportsController — Sprint C
 *
 * GET /reports/heatmap    — heatmap dzień×godzina (JSON)
 * GET /reports/export     — eksport CSV lub XLSX
 *
 * OFFICE_ADMIN widzi tylko swoją org.
 * SUPER_ADMIN / OWNER mogą podać ?orgId= dowolnej org.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ── Heatmap ────────────────────────────────────────────────────
  @Get('heatmap')
  @Roles(...REPORT_ROLES)
  async heatmap(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getHeatmap(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Export CSV / XLSX ──────────────────────────────────────────
  @Get('export')
  @Roles(...REPORT_EXPORT_ROLES)
  async export(
    @Query() dto: ExportReportDto,
    @Res()   res: Response,
    @Request() req: any,
  ) {
    const orgId = req.user.role === 'OWNER' ? (dto as any).orgId : req.user.organizationId;
    const { fromDate, toDate } = this.reports.validateDateRange(dto.from ?? '', dto.to ?? '');
    const rows   = await this.reports.getOccupancyRows(orgId, fromDate, toDate, dto.locationId);
    const format = dto.format ?? 'csv';

    if (format === 'xlsx') {
      const buf = await this.reports.rowsToXlsx(rows);
      const filename = `reserti-report-${dto.from}-${dto.to}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buf);
    } else {
      const buf = this.reports.rowsToCsv(rows);
      const filename = `reserti-report-${dto.from}-${dto.to}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buf);
    }
  }

  // ── Rezerwacje per dzień ────────────────────────────────────────
  @Get('reservations')
  @Roles(...REPORT_ROLES)
  async reservationsByDay(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getReservationsByDay(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Rezerwacje per metoda ────────────────────────────────────────
  @Get('by-method')
  @Roles(...REPORT_ROLES)
  async reservationsByMethod(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getReservationsByMethod(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Rezerwacje per użytkownik ────────────────────────────────────
  @Get('by-user')
  @Roles(...REPORT_ROLES)
  async reservationsByUser(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getReservationsByUser(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Rezerwacje per biurko ────────────────────────────────────────
  @Get('by-desk')
  @Roles(...REPORT_ROLES)
  async reservationsByDesk(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getReservationsByDesk(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Desk Utilization (P4-B2) ───────────────────────────────────
  @Get('utilization')
  @Roles(...REPORT_ROLES)
  async utilization(
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getUtilization(resolvedOrgId, fromDate, toDate, locationId);
  }

  // ── Dashboard snapshot — KPI bieżącego dnia ────────────────────
  @Get('snapshot')
  @Roles(...REPORT_ROLES)
  async snapshot(
    @Query('locationId') locationId: string | undefined,
    @Query('orgId')      orgId:      string | undefined,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    return this.reports.getDashboardSnapshot(resolvedOrgId, locationId);
  }

  // ── Parking report ─────────────────────────────────────────────
  @Get('parking')
  @Roles(...REPORT_ROLES)
  async parkingReport(
    @Query('from')        from:        string,
    @Query('to')          to:          string,
    @Query('locationId')  locationId?: string,
    @Query('resourceId')  resourceId?: string,
    @Query('noCheckinOnly') noCheckinOnly?: string,
    @Query('orgId')       orgId?:      string,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    return this.reports.getParkingReport(resolvedOrgId, {
      from: fromDate, to: toDate, locationId, resourceId,
      noCheckinOnly: noCheckinOnly === 'true',
    });
  }

  @Get('parking/export')
  @Roles(...REPORT_EXPORT_ROLES)
  async exportParking(
    @Query('from')        from:        string,
    @Query('to')          to:          string,
    @Query('locationId')  locationId?: string,
    @Query('resourceId')  resourceId?: string,
    @Query('noCheckinOnly') noCheckinOnly?: string,
    @Query('orgId')       orgId?:      string,
    @Res()   res: Response,
    @Request() req: any,
  ) {
    const resolvedOrgId = this.resolveOrgId(req, orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(from, to);
    const data = await this.reports.getParkingReport(resolvedOrgId, {
      from: fromDate, to: toDate, locationId, resourceId,
      noCheckinOnly: noCheckinOnly === 'true',
    });

    const all = [...data.confirmed, ...data.unconfirmed];
    const lines = all.map(b => {
      const r = b.resource as any;
      const u = b.user as any;
      return [
        b.date?.toString().slice(0, 10) ?? '',
        r?.location?.name ?? '',
        r?.name ?? '',
        r?.code ?? '',
        u?.email ?? '',
        `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim(),
        b.checkedInAt ? b.checkedInAt.toISOString() : '',
        b.checkedInBy ?? '',
      ].join(',');
    });

    const header = 'date,location,resource,code,email,name,checkedInAt,checkedInBy';
    const buf = Buffer.from([header, ...lines].join('\n'), 'utf-8');
    const filename = `reserti-parking-${from}-${to}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  // ── Helper ─────────────────────────────────────────────────────
  private resolveOrgId(req: any, queryOrgId?: string): string {
    const user = req.user;
    const isPrivileged = ['OWNER', 'SUPER_ADMIN'].includes(user.role);

    if (queryOrgId) {
      if (!isPrivileged) {
        throw new ForbiddenException('Only OWNER/SUPER_ADMIN can specify orgId');
      }
      return queryOrgId;
    }

    // OFFICE_ADMIN / STAFF — scoped to own org
    if (!user.organizationId) {
      throw new ForbiddenException('No organizationId in token');
    }
    return user.organizationId;
  }
}
