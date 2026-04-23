import { IsString, IsOptional, IsDateString } from 'class-validator';

export class InviteVisitorDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsDateString()
  visitDate: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}
