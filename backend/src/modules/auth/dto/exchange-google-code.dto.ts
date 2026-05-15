import { IsString, Length } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @Length(1, 128)
  code: string;
}
