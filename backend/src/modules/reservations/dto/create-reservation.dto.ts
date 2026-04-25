import { IsString, IsDateString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  deskId: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsBoolean()
  walkIn?: boolean;

  // FEATURE P4-B1: guest/team reservation type for amber LED
  @IsOptional()
  @IsIn(['STANDARD', 'GUEST', 'TEAM'])
  reservationType?: 'STANDARD' | 'GUEST' | 'TEAM';
}
