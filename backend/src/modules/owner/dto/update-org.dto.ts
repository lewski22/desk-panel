import { IsString, IsBoolean, IsEmail, IsOptional, IsDateString } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional() @IsString()
  plan?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsDateString()
  planExpiresAt?: string;

  @IsOptional() @IsDateString()
  trialEndsAt?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsEmail()
  contactEmail?: string;
}
