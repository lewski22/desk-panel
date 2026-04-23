import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateRecurringDto {
  @IsString()
  deskId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  rule: string;
}
