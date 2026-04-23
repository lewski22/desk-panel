import { IsString, IsOptional } from 'class-validator';

export class ManualCheckinDto {
  @IsString()
  deskId: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  reservationId?: string;
}
