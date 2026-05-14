import { IsString, IsIn, IsOptional, IsNumber, ValidateIf } from 'class-validator';

export class UpdateKioskSettingsDto {
  @IsString()
  locationId: string;

  @IsOptional()
  @ValidateIf(o => o.floor !== null)
  @IsString()
  floor: string | null;

  @IsIn(['tiles', 'map'])
  displayMode: 'tiles' | 'map';

  @IsIn(['auto', 4, 6, 8, 10])
  columns: 'auto' | 4 | 6 | 8 | 10;

  @IsIn([15, 30, 60])
  @IsNumber()
  refreshInterval: 15 | 30 | 60;
}
