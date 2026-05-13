import { IsBoolean } from 'class-validator';

export class UpdateKioskStatusDto {
  @IsBoolean()
  isActive: boolean;
}
