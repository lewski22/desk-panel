import { IsString, IsOptional, IsISO8601, IsUUID, ValidateIf } from 'class-validator';

export class CreateBlockDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}
