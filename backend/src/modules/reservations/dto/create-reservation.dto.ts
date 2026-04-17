import { IsString, IsNotEmpty, IsISO8601, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ example: 'clxxxxxxxxxxxxxxxx' })
  @IsString() @IsNotEmpty()
  deskId: string;

  @ApiProperty({ example: '2025-01-20' })
  @IsISO8601()
  date: string;

  @ApiProperty({ example: '2025-01-20T09:00:00.000Z' })
  @IsISO8601()
  startTime: string;

  @ApiProperty({ example: '2025-01-20T17:00:00.000Z' })
  @IsISO8601()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Admin/Staff only — create reservation on behalf of this user' })
  @IsOptional() @IsString()
  targetUserId?: string;

  /** Sprint G1: iCal RRULE dla cyklicznych rezerwacji
   *  Przykłady:
   *    'FREQ=WEEKLY;BYDAY=MO;COUNT=4'    → co poniedziałek, 4 razy
   *    'FREQ=DAILY;COUNT=5'              → 5 kolejnych dni
   *    'FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T000000Z'
   */
  @ApiPropertyOptional({ example: 'FREQ=WEEKLY;BYDAY=MO;COUNT=4' })
  @IsOptional() @IsString()
  recurrenceRule?: string;
}

// Wewnętrzne pole — ustawiane przez kontroler z JWT, nie przez klienta
// Przekazywane jako część DTO aby serwis mógł zweryfikować org bez kontekstu HTTP
export class ReservationWithOrgDto extends CreateReservationDto {
  actorOrgId?: string;
}
