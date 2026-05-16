import { IsString, IsDateString, IsOptional, IsBoolean, IsIn, IsUUID, MaxLength } from 'class-validator';

export class CreateReservationDto {
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

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsBoolean()
  walkIn?: boolean;

  // FEATURE P4-B1: guest/team reservation type for amber LED
  @IsOptional()
  @IsIn(['STANDARD', 'GUEST', 'TEAM'])
  reservationType?: 'STANDARD' | 'GUEST' | 'TEAM';
}
