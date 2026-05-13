import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

export class SetResourcesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  resourceIds: string[];
}
