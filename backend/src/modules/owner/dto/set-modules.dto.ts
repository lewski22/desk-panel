import { IsArray, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class SetModulesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  enabledModules: string[];
}
