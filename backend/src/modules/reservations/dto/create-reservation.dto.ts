import { IsString, IsNotEmpty, IsISO8601, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ example: 'clxxxxxxxxxxxxxxxx' })
  @IsString() @IsNotEmpty()
  deskId: string;

  @ApiProperty({ example: '2025-01-20' })
  @IsISO8601()
  date: string;

  @ApiProperty({ example: '2025-01-20T09:00:00.000Z' })
  @IsISO8601()
  startTime: string;

  @ApiProperty({ example: '2025-01-20T17:00:00.000Z' })
  @IsISO8601()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
