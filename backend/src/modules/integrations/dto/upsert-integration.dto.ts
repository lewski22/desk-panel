import { IsObject, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpsertIntegrationDto {
  @IsObject()
  config: Record<string, unknown>;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  tenantHint?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
