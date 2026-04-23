import { IsString, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
