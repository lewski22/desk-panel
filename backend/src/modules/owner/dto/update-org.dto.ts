import { IsString, IsBoolean, IsEmail, IsOptional, IsDateString, IsArray, IsInt, Min, Max, ValidateIf } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional() @IsString()
  name?: string;

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

  /** Moduły aktywne dla org. Pusta [] = wszystkie aktywne (backward compat). */
  @IsOptional() @IsArray()
  enabledModules?: string[];

  /** Liczba dni po których hasło wygasa. null = brak rotacji (wyczyść politykę). */
  @IsOptional()
  @ValidateIf(o => o.passwordExpiryDays !== null)
  @IsInt() @Min(1) @Max(365)
  passwordExpiryDays?: number | null;
}
