import { IsString } from 'class-validator';

export class VerifyPinDto {
  @IsString()
  pin: string;
}
