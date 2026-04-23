import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

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
}
