import { IsString, IsDateString, IsOptional, IsIn, IsUUID, MaxLength } from 'class-validator';

export class CreateRecurringDto {
  @IsUUID()
  deskId: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  rule: string;

  @IsOptional()
  @IsIn(['STANDARD', 'GUEST', 'TEAM'])
  reservationType?: 'STANDARD' | 'GUEST' | 'TEAM';
}
