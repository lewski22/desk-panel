import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AddUsersBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  userIds: string[];
}
