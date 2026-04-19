import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ExportReportDto {
  @IsOptional() @IsString()   locationId?: string;
  @IsOptional() @IsString()   orgId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString()   format?: 'csv' | 'xlsx';
}
