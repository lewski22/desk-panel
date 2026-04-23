import { IsBoolean, IsOptional, IsArray, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkSettingItemDto {
  @IsString()
  type: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  thresholdMin?: number;
}
