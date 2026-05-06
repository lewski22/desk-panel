import { IsString, IsBoolean, IsInt, IsOptional, Length, Matches } from 'class-validator';

export class GatewayAckDto {
  @IsString()
  @Length(32, 32)
  @Matches(/^[0-9a-f]+$/)
  nonce: string;

  @IsBoolean()
  ok: boolean;

  @IsInt()
  ts: number;

  @IsString()
  @IsOptional()
  error?: string;
}
