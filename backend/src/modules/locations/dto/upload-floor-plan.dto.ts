import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadFloorPlanDto {
  @IsString()
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
