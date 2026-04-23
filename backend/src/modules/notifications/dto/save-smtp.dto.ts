import { IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveSmtpDto {
  @IsString()
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  secure: boolean;

  @IsString()
  user: string;

  @IsString()
  password: string;

  @IsString()
  fromName: string;

  @IsString()
  fromEmail: string;
}
