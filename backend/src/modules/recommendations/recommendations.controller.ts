/**
 * RecommendationsController — Sprint K1
 *
 * GET /desks/recommended
 *
 * backend/src/modules/recommendations/recommendations.controller.ts
 */
import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }              from '../auth/guards/jwt-auth.guard';
import { RecommendationsService }    from './recommendations.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('desks')
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  /**
   * GET /desks/recommended?locationId=&date=&start=&end=
   *
   * Zwraca jedno rekomendowane biurko dla zalogowanego usera.
   * Null jeśli brak dostępnych biurek lub za mało historii.
   */
  @Get('recommended')
  @ApiOperation({ summary: 'Sugerowane biurko dla usera (K1)' })
  @ApiQuery({ name: 'locationId', required: true })
  @ApiQuery({ name: 'date',       required: true,  description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'start',      required: false, description: 'HH:MM lub ISO' })
  @ApiQuery({ name: 'end',        required: false, description: 'HH:MM lub ISO' })
  async getRecommended(
    @Query('locationId') locationId: string,
    @Query('date')       date:        string,
    @Query('start')      start:       string = '08:00',
    @Query('end')        end:         string = '17:00',
    @Request()           req:         any,
  ) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    const result = await this.svc.getRecommendedDesk(
      req.user.sub ?? req.user.id,
      locationId,
      date ?? new Date().toISOString().slice(0, 10),
      start,
      end,
      actorOrgId,
    );
    return { recommendation: result };
  }
}
