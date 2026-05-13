import { IsIn } from 'class-validator';

export class SetAccessModeDto {
  @IsIn(['PUBLIC', 'GROUP_RESTRICTED'])
  accessMode: 'PUBLIC' | 'GROUP_RESTRICTED';
}
