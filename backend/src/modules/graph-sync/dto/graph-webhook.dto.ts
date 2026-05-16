import { IsArray, IsObject, IsOptional } from 'class-validator';

export class GraphWebhookBodyDto {
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  value?: Record<string, unknown>[];
}
