import { IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlanTemplateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  desks?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  users?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gateways?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locations?: number | null;

  @IsOptional()
  @IsBoolean()
  ota?: boolean;

  @IsOptional()
  @IsBoolean()
  sso?: boolean;

  @IsOptional()
  @IsBoolean()
  smtp?: boolean;

  @IsOptional()
  @IsBoolean()
  api?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMonthlyEurCents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceYearlyEurCents?: number | null;
}
