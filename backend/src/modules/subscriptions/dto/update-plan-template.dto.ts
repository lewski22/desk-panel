import { IsOptional, IsInt, IsBoolean } from 'class-validator';
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
}
