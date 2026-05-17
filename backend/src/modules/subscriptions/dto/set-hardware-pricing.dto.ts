import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetHardwarePricingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  beaconPriceEurCents?: number | null;
}
