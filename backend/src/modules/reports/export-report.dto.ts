import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class ExportReportDto {
  @IsISO8601()
  from: string; // '2026-01-01'

  @IsISO8601()
  to: string;   // '2026-04-17'

  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx' = 'csv';

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  orgId?: string; // tylko dla OWNER/SUPER_ADMIN
}
