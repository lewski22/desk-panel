import { IsString, IsArray } from 'class-validator';

export class AnnounceDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsArray()
  @IsString({ each: true })
  targetRoles: string[];
}
