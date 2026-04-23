import { IsString, IsOptional, IsInt, IsBoolean, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  planExpiresAt?: string;

  @IsOptional()
  @IsString()
  trialEndsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limitDesks?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limitUsers?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limitGateways?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limitLocations?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mrr?: number;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  nextInvoiceAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
