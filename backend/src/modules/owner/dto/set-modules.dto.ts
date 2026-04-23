import { IsArray, IsString } from 'class-validator';

export class SetModulesDto {
  @IsArray()
  @IsString({ each: true })
  enabledModules: string[];
}
