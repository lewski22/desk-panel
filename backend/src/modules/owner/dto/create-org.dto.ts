import { IsString, IsNotEmpty, IsEmail, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateOrgDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  slug: string;

  @IsOptional() @IsString()
  plan?: string;

  @IsOptional() @IsEmail()
  contactEmail?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  trialDays?: number;

  // Pierwszy Super Admin
  @IsEmail()
  adminEmail: string;

  @IsString() @IsNotEmpty()
  adminName: string;
}
