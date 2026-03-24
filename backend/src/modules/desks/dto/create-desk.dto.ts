// ── create-desk.dto.ts ───────────────────────────────────────
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeskStatus } from '@prisma/client';

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
}

// ── update-desk.dto.ts ───────────────────────────────────────
import { PartialType } from '@nestjs/swagger';

export class UpdateDeskDto extends PartialType(CreateDeskDto) {
  @ApiPropertyOptional({ enum: DeskStatus })
  @IsOptional() @IsEnum(DeskStatus)
  status?: DeskStatus;
}
