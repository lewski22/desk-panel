import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { DeskStatus } from '@prisma/client';
import { CreateDeskDto } from './create-desk.dto';

export class UpdateDeskDto extends PartialType(CreateDeskDto) {
  @ApiPropertyOptional({ enum: DeskStatus })
  @IsOptional()
  @IsEnum(DeskStatus)
  status?: DeskStatus;
}
