import { IsString, IsIn } from 'class-validator';

export class CancelRecurringDto {
  @IsString()
  @IsIn(['single', 'following', 'all'])
  scope: 'single' | 'following' | 'all';
}
