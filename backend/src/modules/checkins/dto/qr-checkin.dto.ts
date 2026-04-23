import { IsString } from 'class-validator';

export class QrCheckinDto {
  @IsString()
  deskId: string;

  @IsString()
  qrToken: string;
}
