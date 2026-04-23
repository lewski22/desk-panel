import { IsString } from 'class-validator';

export class NfcCheckinDto {
  @IsString()
  deskId: string;

  @IsString()
  cardUid: string;
}
