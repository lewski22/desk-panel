import { IsString, IsDateString, IsOptional } from 'class-validator';
export class CreateReservationDto {
  @IsString() deskId: string;
  @IsDateString() date: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsOptional() @IsString() notes?: string;
}
