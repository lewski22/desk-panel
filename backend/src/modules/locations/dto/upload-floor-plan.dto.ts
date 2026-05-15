import { IsString, IsOptional, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadFloorPlanDto {
  // Must be a valid HTTP/HTTPS URL or a data: URI (base64 image uploaded to R2).
  @IsString()
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'floorPlanUrl must be an HTTP/HTTPS URL or a data:image/ URI',
  })
  floorPlanUrl: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floorPlanW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floorPlanH?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gridSize?: number;
}
