import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RuleItemDto {
  @IsString()
  type: string;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsString({ each: true })
  targetRoles: string[];
}

export class SaveRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleItemDto)
  rules: RuleItemDto[];
}
