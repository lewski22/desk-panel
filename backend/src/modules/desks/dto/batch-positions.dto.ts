import { IsArray, IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PositionUpdateDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsNumber()
  posX?: number;

  @IsOptional()
  @IsNumber()
  posY?: number;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;
}

export class BatchPositionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionUpdateDto)
  updates: PositionUpdateDto[];
}
