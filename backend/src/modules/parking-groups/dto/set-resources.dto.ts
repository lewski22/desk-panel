import { IsArray, IsString, IsUUID, ArrayMaxSize } from 'class-validator';

export class SetResourcesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  resourceIds: string[];
}
