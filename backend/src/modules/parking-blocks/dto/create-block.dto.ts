import { IsString, IsOptional, IsISO8601, ValidateIf } from 'class-validator';

export class CreateBlockDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}
