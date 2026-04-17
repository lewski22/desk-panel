import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeskDto {
  @ApiProperty({ example: 'Desk A-01' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A-01' })
  @IsString() @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional() @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'Open Space' })
  @IsOptional() @IsString()
  zone?: string;

  // ── Floor Plan Editor (Sprint D) ─────────────────────────
  @ApiPropertyOptional({ example: 45.5, description: 'Pozycja X na floor plan (0–100%)' })
  @IsOptional() @IsNumber() @Min(0) @Max(100)
  posX?: number;

  @ApiPropertyOptional({ example: 30.2, description: 'Pozycja Y na floor plan (0–100%)' })
  @IsOptional() @IsNumber() @Min(0) @Max(100)
  posY?: number;

  @ApiPropertyOptional({ example: 0, enum: [0, 90, 180, 270] })
  @IsOptional() @IsInt()
  rotation?: number;

  @ApiPropertyOptional({ example: 2, description: 'Szerokość tokenu w jednostkach siatki' })
  @IsOptional() @IsNumber() @Min(0.5) @Max(10)
  width?: number;

  @ApiPropertyOptional({ example: 1, description: 'Wysokość tokenu w jednostkach siatki' })
  @IsOptional() @IsNumber() @Min(0.5) @Max(10)
  height?: number;
}
