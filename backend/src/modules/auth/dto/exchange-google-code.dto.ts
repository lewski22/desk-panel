import { IsString, Length } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @Length(48, 48) // randomBytes(24).toString('hex') = exactly 48 hex chars
  code: string;
}
