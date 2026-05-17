import { IsOptional, IsString, MaxLength, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkInvoiceSentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sentTo?: string;
}

export class MarkInvoicePaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;
}
