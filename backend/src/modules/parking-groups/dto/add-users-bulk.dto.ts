import { IsArray, IsString, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AddUsersBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  userIds: string[];
}
