import { IsString, IsInt, Length, Matches } from 'class-validator';

export class GatewayAuthDto {
  @IsString()
  gatewayId: string;

  @IsInt()
  ts: number;

  @IsString()
  @Length(64, 64)
  @Matches(/^[0-9a-f]+$/)
  sig: string;
}
