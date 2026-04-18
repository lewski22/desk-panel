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
  @Roles('OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN')
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
  @Roles('OWNER', 'SUPER_ADMIN', 'OFFICE_ADMIN')
  async export(
    @Query() dto: ExportReportDto,
    @Res()   res: Response,
    @Request() req: any,
  ) {
    const orgId = this.resolveOrgId(req, dto.orgId);
    const { fromDate, toDate } = this.reports.validateDateRange(dto.from, dto.to);
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

    // OFFICE_ADMIN — pobierz orgId z tokenu
    if (!user.organizationId) {
      throw new ForbiddenException('No organizationId in token');
    }
    return user.organizationId;
  }
}
